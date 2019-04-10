import * as path from 'path';
import * as vscode from 'vscode';

export const GlobalVarients = {
  in_use_project_: '',
  selected_config: '',
  tree_view: {}
};


export function GetFileGroupNameFromFile(file: string): string {
  var ext = path.extname(file);
  switch (ext) {
    case '.c':
    case '.cc':
    case '.cxx':
    case '.cpp':
    case '.m':
    case '.mm':
      return 'Source Files';
    case '.h':
    case '.hh':
    case '.hpp':
    case '.hxx':
      return 'Header Files';
    case '.java':
      return 'Java Files';
    case '.cs':
      return 'c# files';
    case '.js':
      return 'Javascript';
    case '.ts':
      return 'Typescript';
    default:
      if (path.basename(file) === 'CMakeLists.txt') {
        return 'CMake Files';
      } else {
        return 'Object Files';
      }
  }
}