import * as exec from 'child_process'
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import * as model from '../Model/project';
import * as cmake from '../Provider/cmake/tree_view_provider';
import * as global from '../utils/globals';
import * as symbolize from '../utils/symbolize'
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
    if (process.platform === 'win32') {
      (terminal as vscode.Terminal).sendText('cmd', true);
    }
  }
  return terminal;
}

var g_output_channel_: any = undefined;
function GetOutputChannel(): vscode.OutputChannel {
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
    var root_path = vscode.workspace.rootPath ? vscode.workspace.rootPath : './'
    var work_dir = path.join(root_path, 'BuildFiles')
    if (!fs.existsSync(work_dir)) {
      fs.mkdirSync(work_dir);
    }

    var vs_config = vscode.workspace.getConfiguration('cpp_solution');
    var extra_flags = vs_config.get<string[]>('extra_cmake_flags', []);
    var extra_flags_value = extra_flags.join(' ');
    var cmd = ';'
    if (process.platform === 'win32') {
      var generator = 'Visual Studio 15';
      var platform = vs_config.get<string>('vs_platform', '');
      if (platform !== '') {
        generator = generator + ' ' + platform;
      }
      cmd = 'cmake -G "' + generator + '" .. ' + extra_flags_value;
    }
    else {
      cmd = 'cmake -G "CodeBlocks - Unix Makefiles" .. ' + extra_flags_value;
    }

    var output = GetOutputChannel();
    output.clear();
    output.show();
    var command_process = exec.spawn(cmd, {shell: true, cwd: work_dir});
    command_process.stdout.on(
        'data', (chunk) => {output.append(chunk.toString())});

    command_process.stderr.on(
        'data', (chunk) => {output.append(chunk.toString())});

    command_process.on('close', (code, signal) => {
      if (code !== 0) {
        output.appendLine('Fail: exit with status ' + code);
      } else {
        output.hide()
        var cmake_provider = this.provider_ as cmake.TreeViewProvider;
        cmake_provider.ReloadProject(path.join(root_path, 'CMakeLists.txt'));
      }
    });
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

class PickFileItem implements vscode.QuickPickItem {
  label: string = '';
  description?: string|undefined;
  detail?: string|undefined;
  picked?: boolean|undefined;
  alwaysShow?: boolean|undefined;
}

class FindFileCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    var files = event.GetAlFilesFromCache();
    var items: PickFileItem[] = [];
    for (var i = 0; i < files.length; i++) {
      var pick: PickFileItem = new PickFileItem();
      pick.label = path.basename(files[i])
      pick.detail = files[i];
      items.push(pick);
    }
    var selected_file = await vscode.window.showQuickPick(
        items,
        {canPickMany: false, matchOnDescription: false, matchOnDetail: false});
    if (!selected_file || !selected_file.detail) {
      return;
    }

    let options:
        vscode.TextDocumentShowOptions = {preview: false, preserveFocus: true};
    let document =
        await vscode.workspace.openTextDocument(selected_file.detail);
    vscode.window.showTextDocument(document, options);
  }
}

class FindSymbolsCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item: view.ProjectViewItem): Promise<void> {
    var symbols = symbolize.all_global_symbols;
    var items: PickFileItem[] = [];
    for (var i = 0; i < symbols.length; i++) {
      var pick: PickFileItem = new PickFileItem();
      pick.label = symbols[i].name;
      pick.description = symbols[i].line.toString();
      pick.detail = symbols[i].file;
      items.push(pick);
    }
    var selected_file = await vscode.window.showQuickPick(
        items,
        {canPickMany: false, matchOnDescription: false, matchOnDetail: false});
    if (!selected_file || !selected_file.detail) {
      return;
    }

    if (selected_file.description) {
      var line = +selected_file.description;
      var sel = new vscode.Selection(line - 1, 0, line - 1, 0);
      let options: vscode.TextDocumentShowOptions = {
        preview: false,
        preserveFocus: true,
        selection: sel
      };
      let document =
          await vscode.workspace.openTextDocument(selected_file.detail);
      vscode.window.showTextDocument(document, options);
    }
  }
}

class FindInSolutionCommand extends AbsCommand {
  constructor(provider: absprovider.TreeViewProviderProjects) {
    super(provider);
  }

  async Run(item_: view.ProjectViewItem): Promise<void> {
    var search_value = ''
    if (!vscode.workspace.rootPath) {
      return;
    }

    if (vscode.window.activeTextEditor) {
      if (vscode.window.activeTextEditor.selections.length > 1) {
        return;
      }

      search_value = vscode.window.activeTextEditor.document.getText(
          vscode.window.activeTextEditor.selection);
    }

    if (search_value === '') {
      let options: vscode.InputBoxOptions = {
        prompt: 'Please input text: ',
        value: search_value
      };

      var user_input = await vscode.window.showInputBox(options);
      if (!user_input || user_input === '') {
        return;
      }
      search_value = user_input;
    }


    const terminal = GetBuildTerminal();
    terminal.show();
    if (process.platform === 'win32') {
      terminal.sendText('cls');
    } else {
      terminal.sendText('reset');
    }

    var cppsolution_dir = path.join(vscode.workspace.rootPath, '.cppsolution');
    var all_files_log = path.join(cppsolution_dir, 'all_files');

    var cat = '';
    var xargs = '';
    var grep = '';
    var sed = '';
    if (process.platform === 'win32') {
      var tool_path = path.join(__dirname, '..', 'utils');
      tool_path = path.normalize(tool_path).split('\\').join('/');
      cat = '"' + path.join(tool_path, 'cat.exe') + '"';
      xargs = '"' + path.join(tool_path, 'xargs.exe') + '"';
      grep = '"' + path.join(tool_path, 'grep.exe') + '"';
    } else {
      cat = 'cat';
      xargs = 'xargs';
      grep = 'grep';
    }

    terminal.sendText(
        cat + ' ' + all_files_log + ' | ' + xargs + ' ' + grep +
        ' -n --color=always "' + search_value);
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
    this.commands_.set('FindSymbols', new FindSymbolsCommand(provider));
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