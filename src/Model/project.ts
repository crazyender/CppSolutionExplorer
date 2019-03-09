import * as path from 'path';
import {Task} from 'vscode';
import * as globals from '../utils/globals';

class PlatformSpecificConfiguration {
  public MIMode: string = '';
}

class LaunchConfiguration {
  public name: string = '';
  public type: string = '';
  public request: string = 'launch';
  public stopAtEntry: boolean = false;
  public program: string = '';
  public args: string[] = [];
  public cwd: string = '${workspaceRoot}';
  public preLaunchTask: string = '';
  public externalConsole: boolean = true;
  public linux: PlatformSpecificConfiguration =
      new PlatformSpecificConfiguration();
  public osx: PlatformSpecificConfiguration =
      new PlatformSpecificConfiguration();
}

export class LaunchConfig {
  public version: string = '0.2.0';
  public configurations: LaunchConfiguration[] = [];
}

class PropertyConfiguration {
  public name: string = '';
  public includePath: string[] = [];
  public defines: string[] = [];
  public cStandard: string = 'c99';
  public cppStandard: string = 'c++11';
  public intelliSenseMode: string = 'clang-x64';
  constructor() {
    if (process.platform === 'win32') {
      this.intelliSenseMode = 'msvc-x64';
    }
  }
}

export class PropertyConfig {
  public configurations: PropertyConfiguration[] = [];
  public version = 4;
}

class BuildGroup {
  public kind: string = '';
  public isDefault: boolean = false;
}
export class BuildTask {
  public label: string = '';
  public type: string = 'shell';
  public command: string = '';
  public group: BuildGroup = new BuildGroup();
}

export class BuildConfig {
  public tasks: BuildTask[] = [];
  public version: string = '2.0.0';
}

export abstract class AbsModel {
  private name_: string;
  private full_name_: string;
  constructor(name: string, full_name: string) {
    this.name_ = name;
    this.full_name_ = full_name;
  }

  GetName() {
    return this.name_;
  }

  GetFullName() {
    return this.full_name_;
  }
}

export class Null extends AbsModel {
  constructor() {
    super('', '');
  }
}

export class File extends AbsModel {
  constructor(full_path: string) {
    super(path.basename(full_path), full_path);
  }
}

export class FileGroup extends AbsModel {
  private files_: string[];
  constructor(name: string, files: string[]) {
    super(name, '');
    this.files_ = files.sort();
  }


  GetFiles() {
    var ret: File[] = [];
    for (var i = 0; i < this.files_.length; i++) {
      ret.push(new File(this.files_[i]));
    }
    return ret;
  }
}

export class Project extends AbsModel {
  private project_type_: Map<string, string>;
  private files_: Map<string, string[]>;
  private raw_files_: string[] = [];
  private defines_: Map<string, string[]>;
  private include_dirs_: Map<string, string[]>;
  private build_command_: Map<string, string>;
  private clean_command_: Map<string, string>;
  private root_dir_: Map<string, string>;
  private readonly_: boolean;
  private binary_: string;
  private path_: string;
  private cpp_standard: Map<string, string> = new Map<string, string>();
  private c_standard: Map<string, string> = new Map<string, string>();
  constructor(
      name: string, file_path: string, full_name: string, project_type: Map<string, string>,
      files: Map<string, string[]>, defines: Map<string, string[]>,
      include_dirs: Map<string, string[]>, compile_flags: Map<string, string[]>,
      root_dir: Map<string, string>, binary: string,
      build_command: Map<string, string>, clean_command: Map<string, string>,
      readonly: boolean) {
    super(name, full_name);
    this.files_ = files;
    this.path_ = file_path;
    this.defines_ = defines;
    this.include_dirs_ = include_dirs;
    this.build_command_ = build_command;
    this.clean_command_ = clean_command;
    this.project_type_ = project_type;
    this.root_dir_ = root_dir;
    this.binary_ = binary;
    this.readonly_ = readonly;
    this.files_.forEach((value, key, self) => {
      value.forEach((file, index, self) => {
        this.raw_files_.push(file);
      });
    });
    this.defines_.forEach((def, config, self) => {
      this.cpp_standard.set(config, '11');
      this.c_standard.set(config, '99');
    });
    this.ParseCompileFlags(compile_flags);
  }

  private ParseCompileFlags(flags_group: Map<string, string[]>) {
    flags_group.forEach((flags, config, self) => {
      for (var i = 0; i < flags.length; i++) {
        var flag = flags[i];
        var includes = this.include_dirs_.get(config);
        if (flag.startsWith('-I') || flag.startsWith('/I')) {
          if (flag === '-I' || flag === '/I') {
            i++;
            if (includes) {
              includes.push(flags[i]);
            }
          } else {
            if (includes) {
              includes.push(flag.substr(2));
            }
          }
          continue;
        }

        if (flag.startsWith('-D') || flag.startsWith('/D')) {
          var defines = this.defines_.get(config);
          if (flag === '-D' || flag === '/D') {
            i++;
            if (defines) {
              defines.push(flags[i]);
            }
          } else {
            if (defines) {
              defines.push(flag.substr(2));
            }
          }
          continue;
        }

        if (flag === '-isystem') {
          i++;
          if (includes) {
            includes.push(flags[i]);
          }
          continue;
        }

        if (flag.startsWith('-std=c++')) {
          this.cpp_standard.set(config, flag.substr(8));
          continue;
        }

        if (flag.startsWith('-std=gnu++')) {
          this.cpp_standard.set(config, flag.substr(10));
          continue;
        }

        if (flag.startsWith('-std=c')) {
          this.c_standard.set(config, flag.substr(6));
          continue;
        }

        if (flag.startsWith('-std=gnu')) {
          this.c_standard.set(config, flag.substr(8));
          continue;
        }
      }
    });
  }

  GetType() {
    return this.project_type_;
  }

  GetLaunchConfig(): LaunchConfiguration|undefined {
    var type = this.project_type_.get(globals.GlobalVarients.selected_config);
    type = type ? type : 'static_library';

    if (type !== 'executable') {
      return undefined;
    }
    var config: LaunchConfiguration = new LaunchConfiguration();
    config.name = this.GetName();
    if (process.platform === 'win32') {
      config.type = 'cppvsdbg';
    } else {
      config.type = 'cppdbg';
    }
    config.program = this.binary_;
    var cwd = this.root_dir_.get(globals.GlobalVarients.selected_config);
    console.log('selected_config: ' + globals.GlobalVarients.selected_config);
    config.cwd = cwd ? cwd : 'xx';
    config.preLaunchTask = 'Build ' + this.GetFullName();
    config.linux.MIMode = 'gdb';
    config.osx.MIMode = 'lldb';
    return config;
  }

  IsReadOnly() {
    return this.readonly_;
  }

  GetPropertyConfig(): PropertyConfig {
    var property = new PropertyConfig();
    var config = new PropertyConfiguration();
    config.name = this.GetFullName();
    config.includePath = this.GetIncludePathes();
    config.defines = this.GetDefines();
    config.cStandard =
        'c' + this.c_standard.get(globals.GlobalVarients.selected_config);
    config.cppStandard =
        'c++' + this.cpp_standard.get(globals.GlobalVarients.selected_config);
    property.configurations.push(config);
    return property;
  }

  GetBuildTask(): BuildTask {
    var task = new BuildTask();
    task.label = 'Build ' + this.GetFullName();
    var command =
        this.build_command_.get(globals.GlobalVarients.selected_config);
    task.command = command ? command : '';
    task.group.isDefault = false;
    task.group.kind = 'build';
    return task;
  }

  GetCleanTask(): BuildTask {
    var task = new BuildTask();
    task.label = 'Clean ' + this.GetFullName();
    var command =
        this.clean_command_.get(globals.GlobalVarients.selected_config);
    task.command = command ? command : '';
    task.group.isDefault = false;
    task.group.kind = 'build';
    return task;
  }

  GetGroups() {
    var ret: FileGroup[] = [];
    var file_groups = Array.from(this.files_.keys()).sort();
    for (var i = 0; i < file_groups.length; i++) {
      var group_name = file_groups[i];
      var full_pathes = this.files_.get(group_name);
      ret.push(new FileGroup(group_name, full_pathes ? full_pathes : []));
    }
    return ret;
  }

  GetDefines() {
    var defs = this.defines_.get(globals.GlobalVarients.selected_config);
    return defs ? defs : [];
  }

  GetIncludePathes() {
    var includes =
        this.include_dirs_.get(globals.GlobalVarients.selected_config);
    return includes ? includes : [];
  }

  GetFiles() {
    return this.raw_files_;
  }

  AddFile(f: string) {
    f = path.join(this.path_, f);
    var group_name = globals.GetFileGroupNameFromFile(f);
    this.raw_files_.push(f);
    var files = this.files_.get(group_name);
    if (files) {
      files.push(f);
    } else {
      this.files_.set(group_name, [f]);
    }
  }

  DeleteFile(file: string) {
    var group_name = globals.GetFileGroupNameFromFile(file);
    this.raw_files_ = this.raw_files_.filter((f, i, self) => {
      return f !== file;
    });
    var files = this.files_.get(group_name);
    if (files) {
      files = files.filter((f, i, self) => {
        return f !== file;
      });
      this.files_.set(group_name, files);
    }
  }
}
