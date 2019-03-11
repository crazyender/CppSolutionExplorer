import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import * as cmake from '../Provider/cmake/tree_view_provider';
import * as absprovider from '../Provider/project_view_provider';
import * as vs from '../Provider/vs/tree_view_provider';
import * as view from '../View/item';

export class TreeViewProviderProjectsEvents {
  public static all_opened_doc: {[id: string]: view.ProjectViewItem;} = {};
  constructor() {
    vscode.window.onDidChangeActiveTextEditor(e => {
      if (!e) {
        return;
      }
      vscode.commands.executeCommand('CppSolutionExplorer.ChangeConfig');
    });
  }
}

export function WatchProject(
    root_path: string, provider: absprovider.TreeViewProviderProjects) {
  if (!fs.existsSync(root_path)) {
    fs.mkdirSync(root_path);
  }

  var file_path = path.join(root_path, 'BuildFiles');
  if (!fs.existsSync(file_path)) {
    fs.mkdirSync(file_path);
  }

  var watch_file = path.join(file_path, 'Project.cbp');
  var cmake_file = path.join(root_path, 'CMakeLists.txt');
  fs.watch(file_path, {}, (e, file) => {
    if (file.endsWith('.sln') || file.endsWith('.vcxproj')) {
      var vs_provider = provider as vs.TreeViewProvider;
      setTimeout(() => {
        vs_provider.RefreshProject(cmake_file);
      }, 2000);

    } else if (file === 'Project.cbp') {
      if (fs.existsSync(watch_file)) {
        var cmake_provider = provider as cmake.TreeViewProvider;
        cmake_provider.RefreshProject(cmake_file);
      }
    }
  });

  fs.watch(cmake_file, {}, (e, f) => {
    if (e === 'change') {
      setTimeout(() => {
        vscode.commands.executeCommand('CppSolutionExplorer.GenerateCMake');
      }, 2000);
    }
  });
}


function DigestPath(input: string): string {
  return crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex');
}

export function AddFileCache(file: string, v: view.ProjectViewItem): void {
  var full_path = file.split('\\').join('/').trim();
  if (process.platform === 'win32') {
    full_path = full_path.toLowerCase();
  }
  TreeViewProviderProjectsEvents.all_opened_doc[full_path] = v;
}

export function GetFileFromCache(file: string): view.ProjectViewItem|undefined {
  var full_path = file.split('\\').join('/').trim();
  if (process.platform === 'win32') {
    full_path = full_path.toLowerCase();
  }
  return TreeViewProviderProjectsEvents.all_opened_doc[full_path];
}