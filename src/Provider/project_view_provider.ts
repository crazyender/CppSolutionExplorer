import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import * as model from '../Model/project';
import * as global from '../utils/globals';
import * as symbolize from '../utils/symbolize'
import * as item from '../View/item';



export abstract class TreeViewProviderProjects implements
    vscode.TreeDataProvider<item.ProjectViewItem> {
  private top_level_item_: item.ProjectViewItem[] = [];
  private all_launchs: model.LaunchConfig = new model.LaunchConfig();
  private all_builds: model.BuildConfig = new model.BuildConfig();

  public solutions: string[] = [];
  public projects_: {[id: string]: model.Project[]} = {};
  public configs_: {[id: string]: string[]} = {};

  public Refresh() {
    this.top_level_item_ = [];
    this.all_builds.tasks = [];
    this.all_launchs.configurations = [];

    for (var i = 0; i < this.solutions.length; i++) {
      var sln_name = this.solutions[i];
      var projects = this.projects_[sln_name];
      var configs = this.configs_[sln_name];

      if (configs.length !== 0) {
        if (global.GlobalVarients.selected_config === '') {
          global.GlobalVarients.selected_config = configs[0];
        }
      } else {
        global.GlobalVarients.selected_config = '';
      }

      projects.forEach((value, index, self) => {
        this.all_builds.tasks.push(value.GetBuildTask());
        this.all_builds.tasks.push(value.GetCleanTask());

        var launch = value.GetLaunchConfig();
        if (launch) {
          this.all_launchs.configurations.push(launch);
        }
      });

      this.top_level_item_.push(
          item.CreateTopLevel(sln_name, projects, configs));
    }

    this._onDidChangeTreeData.fire();

    var json_root =
        vscode.workspace.rootPath ? vscode.workspace.rootPath : './';
    json_root = path.join(json_root, '.vscode');
    if (!fs.existsSync(json_root)) {
      fs.mkdirSync(json_root);
    }
    var tasks = path.join(json_root, 'tasks.json');
    if (fs.existsSync(tasks)) {
      fs.unlinkSync(tasks);
    }
    var launch = path.join(json_root, 'launch.json');
    if (fs.existsSync(launch)) {
      fs.unlinkSync(launch);
    }

    fs.writeFile(
        tasks, JSON.stringify(this.all_builds, undefined, '  '), (err) => {
          fs.writeFile(
              launch, JSON.stringify(this.all_launchs, undefined, '  '),
              (err) => {});
        });
  }

  constructor(files: string[]) {
    // write launch.json and tasks.json
    var all_projects: model.Project[] = [];

    for (var i = 0; i < files.length; i++) {
      var name = path.basename(files[i]);
      var sln_name = name;
      var ext = path.extname(sln_name);
      if (ext !== '') {
        sln_name = sln_name.replace(ext, '');
      }
      this.solutions.push(sln_name);

      var [projects, configs] = this.GetProjects(files[i]);
      this.projects_[sln_name] = projects;
      this.configs_[sln_name] = configs;
      all_projects = all_projects.concat(projects);
    }

    this.Refresh();
    symbolize.Symbolize(all_projects);
  }

  protected abstract GetProjects(root_file: string):
      [model.Project[], string[]];

  private _onDidChangeTreeData:
      vscode.EventEmitter<item.ProjectViewItem|undefined> =
      new vscode.EventEmitter<item.ProjectViewItem|undefined>();
  readonly onDidChangeTreeData: vscode.Event<item.ProjectViewItem|undefined> =
      this._onDidChangeTreeData.event;

  getTreeItem(element: item.ProjectViewItem): vscode.TreeItem
      |Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: item.ProjectViewItem|
              undefined): vscode.ProviderResult<item.ProjectViewItem[]> {
    if (element) {
      return element.GetChildren();
    } else {
      return this.top_level_item_;
    }
  }

  getParent?(element: item.ProjectViewItem|
             undefined): vscode.ProviderResult<item.ProjectViewItem> {
    if (!element) {
      return undefined;
    }
    return element.GetParent();
  }
}