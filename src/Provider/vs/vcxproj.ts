import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as xml from 'xml2js';

function GetCondition(obj: any) {
  if (obj.hasOwnProperty('$') && obj.$.hasOwnProperty('Condition')) {
    var condition = obj.$.Condition as string;
    condition = condition.split('==')[1];
    return condition.substr(1, condition.length - 2);
  } else {
    return '';
  }
}

class ProjectConfiguration {
  public name: string;
  public platform: string;
  public configuration: string;

  constructor(obj: any) {
    this.name = obj.$.Include;
    this.platform = obj.Platform[0];
    this.configuration = obj.Configuration[0];
  }
}

class ProjectConfigProperty {
  public Condition: string;
  public configuration_type: string;
  public use_debug_library: string;
  public platform_tool_set: string;
  public charset: string;
  constructor(obj: any) {
    this.Condition = GetCondition(obj);
    this.configuration_type =
        obj.hasOwnProperty('ConfigurationType') ? obj.ConfigurationType[0] : '';
    this.use_debug_library =
        obj.hasOwnProperty('UseDebugLibraries') ? obj.UseDebugLibraries[0] : '';
    this.platform_tool_set =
        obj.hasOwnProperty('PlatformToolset') ? obj.PlatformToolset[0] : '';
    this.charset =
        obj.hasOwnProperty('CharacterSet') ? obj.CharacterSet[0] : '';
  }
}

class ProjectProperty {
  public Condition: string;
  public link_incremental: string;
  public target_name: string;
  public out_dir: string;

  constructor(obj: any) {
    this.Condition = GetCondition(obj);
    this.link_incremental =
        obj.hasOwnProperty('LinkIncremental') ? obj.LinkIncremental[0] : '';
    this.target_name =
        obj.hasOwnProperty('TargetName') ? obj.TargetName[0] : '';
    this.out_dir = obj.hasOwnProperty('OutDir') ? obj.OutDir[0] : '';
    var platform = '';

    if (this.Condition) {
      platform = this.Condition.split('|')[1]
    } else {
      platform = 'Win32';
    }

    if (this.out_dir === '') {
      if (platform === 'Win32' || platform === 'x86') {
        this.out_dir = '$(SolutionDir)$(Configuration)/';
      } else {
        this.out_dir = '$(SolutionDir)$(Platform)/$(Configuration)/';
      }
    }
  }
}


class CompileSource {
  public file: string;

  constructor(file_path: string, obj: any) {
    var file_ = obj.$.Include;
    if (file_.startsWith('/') || (file_.length >= 2 && file_[1] == ':')) {
      this.file = file_;
    } else {
      this.file = path.join(path.dirname(file_path), file_);
    }
  }
}


class ClCompile extends CompileSource {}

class ClInclude extends CompileSource {}

class CustomBuild extends CompileSource {}

class None extends CompileSource {}

class ItemGroup {
  private project_configs: ProjectConfiguration[] = [];
  private compile_sources: CompileSource[] = [];
  private file_path_: string;

  constructor(file: string, object: any|undefined) {
    this.file_path_ = file;
    if (object) {
      this.Parse(object);
    }
  }

  public GetSources() {
    return this.compile_sources;
  }

  public AddSource(v: CompileSource) {
    this.compile_sources.push(v);
  }

  public RemoveSource(source: CompileSource) {
    this.compile_sources = this.compile_sources.filter((v, index, self) => {
      return v !== source;
    });
  }


  private Parse(proj: any) {
    if (!proj.hasOwnProperty('ItemGroup')) {
      return;
    }

    proj.ItemGroup.forEach((obj: any, index: any, self: any) => {
      if (obj.hasOwnProperty('$') && obj.$.Label === 'ProjectConfigurations') {
        if (obj.hasOwnProperty('ProjectConfiguration')) {
          for (var i = 0; i < obj.ProjectConfiguration.length; i++) {
            this.project_configs.push(
                new ProjectConfiguration(obj.ProjectConfiguration[i]));
          }
        }

      } else {
        if (obj.hasOwnProperty('ClCompile')) {
          for (var i = 0; i < obj.ClCompile.length; i++) {
            this.compile_sources.push(
                new ClCompile(this.file_path_, obj.ClCompile[i]));
          }
        }

        if (obj.hasOwnProperty('CustomBuild')) {
          for (var i = 0; i < obj.CustomBuild.length; i++) {
            this.compile_sources.push(
                new CustomBuild(this.file_path_, obj.CustomBuild[i]));
          }
        }

        if (obj.hasOwnProperty('ClInclude')) {
          for (var i = 0; i < obj.ClInclude.length; i++) {
            this.compile_sources.push(
                new ClInclude(this.file_path_, obj.ClInclude[i]));
          }
        }

        if (obj.hasOwnProperty('None')) {
          for (var i = 0; i < obj.None.length; i++) {
            this.compile_sources.push(new None(this.file_path_, obj.None[i]));
          }
        }
      }
    });
  }
}


class CompileConfig {
  public AdditionalIncludeDirectories: string[] = [];
  public PreprocessorDefinitions: string[] = [];
  public AdditionalOptions: string[] = [];
  public WarningLevel: string = 'Level3';
  public RuntimeLibrary: string = '';
  public Optimization: string = '';
  public file_path: string = '';

  constructor(file: string, obj: any|undefined) {
    if (!obj) {
      return;
    }

    this.file_path = file;

    if (obj.hasOwnProperty('AdditionalIncludeDirectories')) {
      var includes = obj.AdditionalIncludeDirectories[0];
      includes = includes.split('%(AdditionalIncludeDirectories)').join('')
      includes = includes.split('\\').join('/');
      var values = includes.split(';') as string[];
      values = values.map((v, index, self) => {
        if (v.startsWith('/') || (v.length >= 2 && v[1] == ':')) {
          return v;
        } else {
          return path.join(path.dirname(this.file_path), v);
        }
      });
      this.AdditionalIncludeDirectories =
          this.AdditionalIncludeDirectories.concat(values);
    }

    if (obj.hasOwnProperty('PreprocessorDefinitions')) {
      var defines = obj.PreprocessorDefinitions[0];
      defines = defines.split('%(PreprocessorDefinitions)').join('')
      defines = defines.split('\\').join('/');
      this.PreprocessorDefinitions =
          this.PreprocessorDefinitions.concat(defines.split(';'));
    }

    if (obj.hasOwnProperty('AdditionalOptions')) {
      var flags = obj.AdditionalOptions[0];
      flags = flags.split('%(AdditionalOptions)').join('')
      flags = flags.split('\\').join('/');
      this.AdditionalOptions = this.AdditionalOptions.concat(flags.split(' '));
    }

    if (obj.hasOwnProperty('WarningLevel')) {
      this.WarningLevel = obj.WarningLevel[0];
    }

    if (obj.hasOwnProperty('RuntimeLibrary')) {
      this.RuntimeLibrary = obj.RuntimeLibrary[0];
    }

    if (obj.hasOwnProperty('Optimization')) {
      this.Optimization = obj.Optimization[0];
    }
  }
}

class LinkConfig {
  public SubSystem: string = '';
  public GenerateDebugInformation: string = 'true';
  constructor(obj: any|undefined) {
    if (!obj) {
      return;
    }

    if (obj.hasOwnProperty('SubSystem')) {
      this.SubSystem = obj.SubSystem[0];
    }

    if (obj.hasOwnProperty('GenerateDebugInformation')) {
      this.GenerateDebugInformation = obj.GenerateDebugInformation[0];
    }
  }
}


class ItemDefinitionGroup {
  public Condition: string = '';
  public CompileConfig: CompileConfig = new CompileConfig('', undefined);
  public LinkConfig: LinkConfig = new LinkConfig(undefined);
  public file_path: string = '';

  constructor(file: string, obj: any) {
    this.file_path = file;

    this.Condition = GetCondition(obj);

    if (obj.hasOwnProperty('ClCompile')) {
      this.CompileConfig = new CompileConfig(file, obj.ClCompile[0]);
    }

    if (obj.hasOwnProperty('Link')) {
      this.LinkConfig = new LinkConfig(obj.Link[0]);
    }
  }
}

export class Project {
  private name_: string;
  private path_: string;
  private uuid_: string;
  private item_group: ItemGroup|undefined;
  // condition => ItemDefinitionGroup
  private item_definition_group: Map<string, ItemDefinitionGroup> =
      new Map<string, ItemDefinitionGroup>();
  private project_property: Map<string, ProjectProperty> =
      new Map<string, ProjectProperty>();
  private project_config_property: Map<string, ProjectConfigProperty> =
      new Map<string, ProjectConfigProperty>();
  private platform_mapper: Map<string, string> = new Map<string, string>();
  private string_mapper: Map<string, string> = new Map<string, string>();
  private compatiable_mode: boolean = true;

  constructor(name: string, path: string, uuid: string) {
    this.name_ = name;
    this.path_ = path;
    this.uuid_ = uuid;
    this.item_group = undefined;
    this.platform_mapper.set('Win32', 'x86');
    this.platform_mapper.set('x86', 'x86');
    this.platform_mapper.set('x64', 'x64');
    this.string_mapper.set(
        '$(SolutionDir)',
        vscode.workspace.rootPath ? vscode.workspace.rootPath + '/' : './');

    this.string_mapper.set('$(ProjectName)', this.name_);
    this.string_mapper.set('$(ProjectPath)', this.path_);
  }

  GetName(): string {
    return this.name_;
  }

  SetName(name: string): void {
    this.name_ = name;
  }

  GetPath(): string {
    return this.path_;
  }

  SetPath(path: string): void {
    this.path_ = path;
  }

  Parse(): void {
    var content = fs.readFileSync(this.path_).toString();
    var xml_object = xml.parseString(content, (err, result) => {
      if (!result.hasOwnProperty('Project')) {
        return;
      }

      if (!result.Project.hasOwnProperty('ItemGroup')) {
        return;
      }

      if (!result.Project.hasOwnProperty('ItemDefinitionGroup')) {
        return;
      }

      this.item_group = new ItemGroup(this.path_, result.Project);

      result.Project.ItemDefinitionGroup.forEach(
          (idg: any, index: any, self: any) => {
            var g = new ItemDefinitionGroup(this.path_, idg);
            this.item_definition_group.set(g.Condition, g);
          });

      if (result.Project.hasOwnProperty('PropertyGroup')) {
        result.Project.PropertyGroup.forEach(
            (elem: any, index: any, self: any) => {
              if (elem.hasOwnProperty('$') && elem.$.hasOwnProperty('Label') &&
                  elem.$.Label === 'Configuration') {
                var g = new ProjectConfigProperty(elem);
                this.project_config_property.set(g.Condition, g);
              } else if (
                  elem.hasOwnProperty('$') && !elem.$.hasOwnProperty('Label')) {
                var p = new ProjectProperty(elem);
                this.project_property.set(p.Condition, p);
              }
            });
      }

      this.compatiable_mode = false;

      if (result.Project.hasOwnProperty("ImportGroup")) {
        result.Project.ImportGroup.forEach((elem: any, index: Number, self: any) => {
          if (elem.hasOwnProperty("$") && elem.$.hasOwnProperty("Label") && elem.$.Label === "ExtensionTargets") {
            if (process.platform === "win32") {
              // only msbuild from VisualStudio can handle ExtensionTargets property
              this.compatiable_mode = true;
            }
          }
        });
      }
    });
  }

  IsReadOnly() {
    return !this.compatiable_mode;
  }

  GetFiles(): string[] {
    if (!this.item_group) {
      return [];
    }

    return this.item_group.GetSources().map((v, index, self) => {
      return v.file;
    });
  }

  GetUUID(): string {
    return this.uuid_;
  }

  SetUUID(uuid: string) {
    this.uuid_ = uuid;
  }

  Save(): void {
    throw new Error('Not implement');
  }

  AddFile(file: string) {
    throw new Error('Not implement');
  }

  RemoveFile(file: string, permanent: boolean) {
    throw new Error('Not implement');
  }

  GetDefines(config: string|undefined): string[] {
    var no_condition = this.item_definition_group.get('');
    var no_condition_values =
        no_condition ? no_condition.CompileConfig.PreprocessorDefinitions : [];
    if (!config || config === '') {
      return no_condition_values;
    }

    var condition = this.item_definition_group.get(config);
    var condition_values =
        condition ? condition.CompileConfig.PreprocessorDefinitions : [];

    return no_condition_values.concat(condition_values);
  }

  SetDefines(config: string|undefined, defines: string[]) {
    if (!config || config === '') {
      var no_condition = this.item_definition_group.get('');
      if (no_condition) {
        no_condition.CompileConfig.PreprocessorDefinitions = defines;
      }
    } else {
      var condition = this.item_definition_group.get(config);
      if (!condition) {
        throw new Error('No such configuration: ' + config);
      }
      condition.CompileConfig.PreprocessorDefinitions = defines;
    }
  }


  GetIncludeDirs(config: string|undefined): string[] {
    var no_condition = this.item_definition_group.get('');
    var no_condition_values = no_condition ?
        no_condition.CompileConfig.AdditionalIncludeDirectories :
        [];
    if (!config || config === '') {
      return this.StringSubstitution(no_condition_values, config);
    }

    var condition = this.item_definition_group.get(config);
    var condition_values =
        condition ? condition.CompileConfig.AdditionalIncludeDirectories : [];

    return this.StringSubstitution(
        no_condition_values.concat(condition_values), config);
  }

  SetIncludeDirs(config: string|undefined, includes: string[]) {
    if (!config || config === '') {
      var no_condition = this.item_definition_group.get('');
      if (no_condition) {
        no_condition.CompileConfig.AdditionalIncludeDirectories = includes;
      }
    } else {
      var condition = this.item_definition_group.get(config);
      if (!condition) {
        throw new Error('No such configuration: ' + config);
      }
      condition.CompileConfig.AdditionalIncludeDirectories = includes;
    }
  }

  GetLibDirs(config: string|undefined): string[] {
    throw new Error('Not implement');
  }

  SetLibDirs(config: string|undefined, dirs: string[]) {
    throw new Error('Not implement');
  }

  GetCompileFlags(config: string|undefined): string[] {
    var no_condition = this.item_definition_group.get('');
    var no_condition_values =
        no_condition ? no_condition.CompileConfig.AdditionalOptions : [];
    if (!config || config === '') {
      return no_condition_values;
    }

    var condition = this.item_definition_group.get(config);
    var condition_values =
        condition ? condition.CompileConfig.AdditionalOptions : [];

    return no_condition_values.concat(condition_values);
  }

  SetCompileFlags(config: string|undefined, flags: string[]) {
    if (!config || config === '') {
      var no_condition = this.item_definition_group.get('');
      if (no_condition) {
        no_condition.CompileConfig.AdditionalOptions = flags;
      }
    } else {
      var condition = this.item_definition_group.get(config);
      if (!condition) {
        throw new Error('No such configuration: ' + config);
      }
      condition.CompileConfig.AdditionalOptions = flags;
    }
  }

  GetLinkFlags(config: string|undefined): string[] {
    throw new Error('Not implement');
  }

  SetLinkFlags(config: string|undefined, flags: string[]) {
    throw new Error('Not implement');
  }

  GetIntermediatePath(config: string|undefined): string {
    throw new Error('Not implement');
  }

  SetIntermediatePath(config: string|undefined, path: string) {
    throw new Error('Not implement');
  }

  GetOutputPath(config: string|undefined): string {
    var no_condition = this.project_property.get('');
    var no_condition_values = no_condition ? no_condition.out_dir : '';
    if (!config || config === '') {
      return this.StringSubstitution([no_condition_values], config)[0];
    }

    var condition = this.project_property.get(config);
    var condition_values = condition ? condition.out_dir : '';

    return this.StringSubstitution([condition_values], config)[0];
  }

  SetOutputPath(config: string|undefined, path: string) {
    if (!config || config === '') {
      var no_condition = this.project_property.get('');
      if (no_condition) {
        no_condition.out_dir = path;
      }
    } else {
      var condition = this.project_property.get(config);
      if (!condition) {
        throw new Error('No such configuration: ' + config);
      }
      condition.out_dir = path;
    }
  }

  GetProjectType(config: string|undefined): string {
    var no_condition = this.project_config_property.get('');
    var no_condition_values =
        no_condition ? no_condition.configuration_type : '';
    if (!config || config === '') {
      return no_condition_values;
    }

    var condition = this.project_config_property.get(config);
    var condition_values = condition ? condition.configuration_type : '';

    return condition_values;
  }

  SetProjectType(config: string|undefined, type: string) {
    if (!config || config === '') {
      var no_condition = this.project_config_property.get('');
      if (no_condition) {
        no_condition.configuration_type = type;
      }
    } else {
      var condition = this.project_config_property.get(config);
      if (!condition) {
        throw new Error('No such configuration: ' + config);
      }
      condition.configuration_type = type;
    }
  }


  StringSubstitution(strs: string[], config: string|undefined) {
    if (config) {
      var config_name = config.split('|')[0];
      var platform_name = config.split('|')[1];
      var platform_short_name = this.platform_mapper.get(platform_name);
      if (!platform_short_name) {
        platform_short_name = platform_name;
      }
      this.string_mapper.set('$(PlatformShortName)', platform_short_name);
      this.string_mapper.set('$(Platform)', platform_name);
      this.string_mapper.set('$(Configuration)', config_name);
      this.string_mapper.set('$(ConfigurationName)', config_name);
    }
    var ret: string[] = [];
    for (var j = 0; j < strs.length; j++) {
      var str = strs[j];
      var keys = Array.from(this.string_mapper.keys());
      for (var i = 0; i < keys.length; i++) {
        var old = keys[i];
        var new_ = this.string_mapper.get(old);
        if (!new_) {
          new_ = old;
        }
        str = str.replace(old, new_);
      }
      ret.push(str);
    }
    return ret;
  }
}
