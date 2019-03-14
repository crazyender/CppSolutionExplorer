import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import * as model from '../../Model/project';
import * as globals from '../../utils/globals';
import * as absprovider from '../project_view_provider';

import * as sln from './sln';


export function ReloadProject(
    cmake_path: string, sln_path: string): [model.Project[], string[]] {
  var projects: model.Project[] = [];

  var sln_name = path.basename(sln_path);
  var root = vscode.workspace.rootPath ? vscode.workspace.rootPath : './';
  var file = sln_path;

  // I don't like nested projects (project under folder), so I will not
  // implement them
  var solution = sln.ReadSolution(file);
  var vcprojects = solution.GetVcProjects();


  vcprojects.forEach((proj, index, self) => {
    var proj_files: Map<string, string[]> = new Map<string, string[]>();
    var sources = proj.GetFiles();
    sources = sources.filter((file, index, self) => {
      var ext = path.extname(file);
      if (ext === '.c' || ext === '.cpp' || ext === '.cc' || ext === '.cxx' ||
          ext === '.h' || ext === '.hh' || ext === '.hpp' || ext === '.m' ||
          ext === '.mm' || ext === '.java') {
        return true;
      }
      return false;
    });

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      var group_name = globals.GetFileGroupNameFromFile(source);
      var v = proj_files.get(group_name);
      if (v) {
        v.push(source);
      } else {
        proj_files.set(group_name, [source]);
      }
    }

    var project_types = new Map<string, string>();
    var out_pathes = new Map<string, string>();
    var defines = new Map<string, string[]>();
    var includes = new Map<string, string[]>();
    var flags = new Map<string, string[]>();
    var build_commands = new Map<string, string>();
    var clean_commands = new Map<string, string>();
    var configs = solution.GetConfigurations();
    var binaries = new Map<string, string>();
    for (var i = 0; i < configs.length; i++) {
      var config = configs[i];
      var proj_config = solution.GetProjectConfigName(proj.GetUUID(), config);
      defines.set(config, proj.GetDefines(proj_config));
      includes.set(config, proj.GetIncludeDirs(proj_config));
      flags.set(config, proj.GetCompileFlags(proj_config));
      var build_command = '';
      var clean_command = '';

      if (cmake_path === '') {
        build_command = sln.GetMsbuild() + ' ' + path.basename(file) +
            ' -t:' + proj.GetName() +
            ' -property:Configuration=' + config.split('|')[0] +
            ' -property:Platform=' + config.split('|')[1];
        clean_command = sln.GetMsbuild() + ' ' + path.basename(file) +
            ' -t:Clean' +
            ' -property:Configuration=' + config.split('|')[0] +
            ' -property:Platform=' + config.split('|')[1];
      } else {
        build_command = 'cmake --build ' + path.dirname(cmake_path) +
            '/BuildFiles --target ' + proj.GetName() + ' --config ' +
            config.split('|')[0];
        clean_command = 'cmake --build ' + path.dirname(cmake_path) +
            '/BuildFiles --target clean --config ' + config.split('|')[0];
      }
      build_commands.set(config, build_command);
      clean_commands.set(config, clean_command);
      binaries.set(config, proj.GetOutputBinray(config));

      out_pathes.set(config, proj.GetOutputPath(proj_config));

      var proj_type = 'static_library';
      switch (proj.GetProjectType(proj_config)) {
        case 'Application':
          proj_type = 'executable';
          break;
        case 'DynamicLibrary':
          proj_type = 'shared_library';
          break;
        case 'StaticLibrary':
          proj_type = 'static_library';
          break;
        default:
          proj_type = 'static_library';
          break;
      }

      project_types.set(config, proj_type);
    }

    var p = new model.Project(
        proj.GetName(), proj.GetPath(),
        path.basename(file) + ':' + proj.GetPath(), project_types, proj_files,
        defines, includes, flags, out_pathes, binaries, build_commands,
        clean_commands, true, process.platform === 'win32');
    projects.push(p);
  });
  return [projects, solution.GetConfigurations()];
}

export function ReloadCmakeProject(file: string): [model.Project[], string[]] {
  var cmake_path = file;
  var build_files = path.join(path.dirname(cmake_path), 'BuildFiles');
  if (!fs.existsSync(build_files)) {
    return [[], []];
  }

  var files = fs.readdirSync(build_files, {});
  for (var i = 0; i < files.length; i++) {
    var file = files[i].toString();
    if (!file.endsWith('.sln')) {
      continue;
    }
    var sln_file = path.join(build_files, file);
    return ReloadProject(cmake_path, sln_file);
  }
  return [[], []];
}

export class TreeViewProvider extends absprovider.TreeViewProviderProjects {
  protected GetProjects(file: string): [model.Project[], string[]] {
    if (!fs.existsSync(file)) {
      return [[], []];
    }

    if (path.basename(file) === 'CMakeLists.txt') {
      return ReloadCmakeProject(file);
    } else {
      return ReloadProject('', file);
    }
  }


  public RefreshProject(file: string) {
    var [proj, config] = ReloadCmakeProject(file);
    this.projects_ = {};
    this.configs_ = {};
    this.projects_[this.solutions[0]] = proj;
    this.configs_[this.solutions[0]] = config;
    console.log(this.configs_);
    this.Refresh();
  }
}