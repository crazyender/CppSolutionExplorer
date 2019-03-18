import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import * as model from '../Model/project';
import * as cmake from '../Provider/cmake/tree_view_provider';
import * as global from '../utils/globals';
import * as worker from '../utils/worker';
import * as view from '../View/item';

import * as absprovider from './project_view_provider';
import * as event from './view_provider_events';


function GetBuildTerminal(): vscode.Terminal {
  let terminal: any = undefined;
  vscode.window.terminals.forEach(t => {
    if (t.name === 'build') {
      terminal = t;
    }
  });
  if (!terminal) {
    terminal = vscode.window.createTerminal('build');
  }
  return terminal;
}

var g_output_channel_: any = undefined;
function GetFindResultPanel(): vscode.OutputChannel {
  if (!g_output_channel_) {
    g_output_channel_ =
        vscode.window.createOutputChannel('Cpp Solution Explorer');
  }
  return g_output_channel_;
}

abstract class AbsCommand {
  protected provider_: absprovider.TreeViewProviderProjects;
  constructor(provider: absprovider.TreeViewProviderProjects) {
    this.provider_ = provider;
  }

  public abstract async Run(item: view.ProjectViewItem): Promise<void>;

  GetProvider() {
    return this.provider_;
  }
}

class OpenFileCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    if (item.GetItemType() !== view.ItemType.FILE) {
      return;
    }
    var full_path = item.GetModel().GetFullName();
    let options:
        vscode.TextDocumentShowOptions = {preview: false, preserveFocus: true};
    let document = await vscode.workspace.openTextDocument(full_path);
    vscode.window.showTextDocument(document, options);
  }
}

class GenerateCMakeCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    const terminal = GetBuildTerminal();
    terminal.show();

    var root_path = vscode.workspace.rootPath ? vscode.workspace.rootPath : './'
    var work_dir = path.join(root_path, 'BuildFiles')
    if (!fs.existsSync(work_dir)) {
      fs.mkdirSync(work_dir);
    }
    terminal.sendText('reset');
    terminal.sendText('cd "' + work_dir + '"');
    var vs_config = vscode.workspace.getConfiguration('cpp_solution');
    var extra_flags = vs_config.get<string[]>('extra_cmake_flags', []);
    var extra_flags_value = extra_flags.join(' ');
    if (process.platform === 'win32') {
      var generator = 'Visual Studio 15';
      var platform = vs_config.get<string>('vs_platform', '');
      if (platform !== '') {
        generator = generator + ' ' + platform;
      }
      terminal.sendText('cmake -G "' + generator + '" .. ' + extra_flags_value);
    } else {
      terminal.sendText(
          'cmake -G "CodeBlocks - Unix Makefiles" .. ' + extra_flags_value);
    }
    terminal.sendText('cd "' + root_path + '"');

    var cmake_provider = this.provider_ as cmake.TreeViewProvider;
    cmake_provider.ReloadProject(path.join(root_path, 'CMakeLists.txt'))
  }
}

class BuildProjectCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    if (item.GetItemType() === view.ItemType.PROJECT) {
      // build project
      var project_model = item.GetModel() as model.Project;
      var cmd = project_model.GetBuildTask().command;
      const terminal = GetBuildTerminal();
      terminal.show();
      var root_path =
          vscode.workspace.rootPath ? vscode.workspace.rootPath : './';
      if (process.platform === 'win32') {
        terminal.sendText('cls');
      } else {
        terminal.sendText('reset');
      }

      terminal.sendText('cd "' + root_path + '"');
      terminal.sendText(cmd, true);
      terminal.sendText('cd "' + root_path + '"');
    } else {
      return;
    }
  }
}

class RebuildProjectCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    if (item.GetItemType() === view.ItemType.PROJECT) {
      // build project
      var project_model = item.GetModel() as model.Project;
      const terminal = GetBuildTerminal();
      terminal.show();
      terminal.sendText(project_model.GetCleanTask().command, true);
      terminal.sendText(project_model.GetBuildTask().command, true);
    } else {
      return;
    }
  }
}

class CleanProjectCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    if (item.GetItemType() === view.ItemType.PROJECT) {
      // clean project
      var project_model = item.GetModel() as model.Project;
      var cmd = project_model.GetCleanTask().command;
      const terminal = GetBuildTerminal();
      terminal.show();
      terminal.sendText(cmd, true);
    } else {
      return;
    }
  }
}

class FindFileCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    if (item.GetItemType() === view.ItemType.TOP_LEVEL) {
      // get file name from user
      let options: vscode.InputBoxOptions = {
        prompt: 'Please input file name: ',
        value: ''
      };

      var file_name = '';
      await vscode.window.showInputBox(options).then(value => {
        if (!value) {
          return;
        }
        file_name = value;
      });

      if (file_name === '') {
        return;
      }

      var panel = GetFindResultPanel();
      panel.show();
      panel.clear();
      var projects = item.GetChildren();
      var total_count = 0;
      var file_count = 0;
      var w = worker.CreateWorker('project', projects, (project) => {
        if (project.contextValue === 'configs') {
          return;
        }
        var project_model = project.GetModel() as model.Project;
        var files = project_model.GetFiles();
        worker.CreateWorker('file', files, (file) => {
          if (process.platform === 'win32') {
            file = '/' + file;
          }
          if (file.indexOf(file_name) !== -1) {
            panel.appendLine('file://' + file);
            file_count++;
          }
          total_count++;
        }, () => {});
      }, () => {});
    } else {
      return;
    }
  }
}

class FindInSolutionCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item_: view.ProjectViewItem): Promise<void> {
    if (!vscode.window.activeTextEditor) {
      return;
    }
    if (vscode.window.activeTextEditor.selections.length > 1) {
      return;
    }
    var file_path = vscode.window.activeTextEditor.document.fileName;
    var search_value = vscode.window.activeTextEditor.document.getText(
        vscode.window.activeTextEditor.selection);
    let options: vscode.InputBoxOptions = {
      prompt: 'Please input text: ',
      value: search_value
    };
    await vscode.window.showInputBox(options).then(value => {
      if (!value) {
        return;
      }
      search_value = value;
    });

    if (search_value === '') {
      return;
    }
    var v = event.GetFileFromCache(file_path);
    if (!v) {
      return;
    }
    var item = v;
    var p = v.GetParent();
    if (p) {
      var pp = p.GetParent();
      if (pp) {
        var ppp = pp.GetParent();
        if (ppp) {
          item = ppp;
        }
      }
    }

    if (item.GetItemType() === view.ItemType.TOP_LEVEL) {
      var panel = GetFindResultPanel();
      panel.show();
      panel.clear();
      var projects = item.GetChildren();
      var record_count = 0;
      var file_count = 0;
      worker.CreateWorker('project', projects, (project) => {
        if (project.contextValue === 'configs') {
          return;
        }
        var project_model = project.GetModel() as model.Project;
        var files = project_model.GetFiles();
        worker.CreateWorker('file', files, (file) => {
          var txt: string = fs.readFileSync(file).toString();
          var lines = txt.split('\n');
          var found = false;
          if (process.platform === 'win32') {
            file = '/' + file;
          }
          lines.forEach((line, index, self) => {
            if (line.indexOf(search_value) !== -1) {
              panel.appendLine(
                  'file://' + file + '#L' + (index + 1) + ' : ' + line);
              found = true;
              record_count++;
            }
          });
          if (found) {
            file_count++;
          }
        }, () => {});
      }, () => {});
    } else {
      return;
    }
  }
}

async function DoChangeConfigCommand(item: view.ProjectViewItem):
    Promise<void> {
  if (!vscode.window.activeTextEditor) {
    return;
  }
  var file_path = vscode.window.activeTextEditor.document.fileName;
  var v = event.GetFileFromCache(file_path);
  if (!v) {
    return;
  }
  if (v.GetItemType() !== view.ItemType.FILE) {
    return;
  }
  var group = v.GetParent();
  if (!group) {
    return;
  }
  var project = group.GetParent();
  if (!project) {
    return;
  }

  var project_model = project.GetModel() as model.Project;
  if (global.GlobalVarients.in_use_project_ ===
      (project_model.GetFullName() + ':' +
       global.GlobalVarients.in_use_project_)) {
    return;
  }
  global.GlobalVarients.in_use_project_ =
      project_model.GetFullName() + ':' + global.GlobalVarients.in_use_project_;
  var c_cpp = project_model.GetPropertyConfig();
  var json_root = vscode.workspace.rootPath ? vscode.workspace.rootPath : './';
  json_root = path.join(json_root, '.vscode');
  if (!fs.existsSync(json_root)) {
    fs.mkdirSync(json_root);
  }
  var c_pp_property = path.join(json_root, 'c_cpp_properties.json');
  if (fs.existsSync(c_pp_property)) {
    fs.unlinkSync(c_pp_property);
  }
  fs.writeFile(
      c_pp_property, JSON.stringify(c_cpp, undefined, '  '),
      (err) => {

      });
}

async function RefreshTreeView(
    cmd: AbsCommand, item: view.ProjectViewItem): Promise<void> {
  cmd.GetProvider().Refresh();
}

class ChangeConfigCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    return DoChangeConfigCommand(item);
  }
}

export class SelectConfigCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    if (item.GetItemType() !== view.ItemType.CONFIG) {
      return;
    }

    global.GlobalVarients.selected_config = item.label ? item.label : '';
    DoChangeConfigCommand(item);
    this.provider_.Refresh();
  }
}

export class AddFileCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    let options:
        vscode.InputBoxOptions = {prompt: 'Input file name: ', value: ''};
    var file_name = '';
    await vscode.window.showInputBox(options).then(value => {
      if (!value) {
        return;
      }
      file_name = value;
    });

    if (file_name === '') {
      return;
    }

    var proj = item.GetModel() as model.Project;
    proj.AddFile(file_name);
    RefreshTreeView(this, item);
  }
}

export class DeleteFileCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    var message_option: vscode.MessageOptions = {modal: true};
    var answer = await vscode.window.showWarningMessage(
        'Delete this file?', message_option, 'Yes');
    if (!answer || answer !== 'Yes') {
      return;
    }
    var model_file = item.GetModel() as model.File;
    var path = model_file.GetFullName();
    var group = item.GetParent();
    if (!group) {
      return;
    }
    var project = group.GetParent();
    if (!project) {
      return;
    }
    var project_model = project.GetModel() as model.Project;
    project_model.DeleteFile(path);
    RefreshTreeView(this, item);
  }
}

export class RenameFileCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {}
}

export class AddProjectCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {}
}

export class DeleteProjectCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {}
}

export class RenameProjectCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {}
}

export class RefreshCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    RefreshTreeView(this, item);
  }
}


export class TreeViewProviderProjectsCommands {
  private commands_: Map<string, AbsCommand> = new Map<string, AbsCommand>();

  constructor(provider: absprovider.TreeViewProviderProjects) {
    this.commands_.set('OpenFile', new OpenFileCommand(provider));
    this.commands_.set('BuildProject', new BuildProjectCommand(provider));
    this.commands_.set('RebuildProject', new RebuildProjectCommand(provider));
    this.commands_.set('CleanProject', new CleanProjectCommand(provider));
    this.commands_.set('ChangeConfig', new ChangeConfigCommand(provider));
    this.commands_.set('FindFile', new FindFileCommand(provider));
    this.commands_.set('FindInSolution', new FindInSolutionCommand(provider));
    this.commands_.set('SelectConfig', new SelectConfigCommand(provider));
    this.commands_.set('Refresh', new RefreshCommand(provider));
    this.commands_.set('GenerateCMake', new GenerateCMakeCommand(provider));
  }

  public Register(): void {
    this.commands_.forEach((value, key, self) => {
      vscode.commands.registerCommand('CppSolutionExplorer.' + key, item => {
        value.Run(item);
      });
    });
  }
}