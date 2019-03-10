import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as absprovider from '../project_view_provider';
import * as model from "../../Model/project";
import * as xml from 'xml2js';
import * as globals from "../../utils/globals";

class CMakeProject {
    public Title: string = "";
    public Type: string = "";
    public Output: string = "";
    public OutDir: string = "";
    public IncludeDirs: string[] = [];
    public Flags: string[] = [];
    public Files: string[] = [];
}

export class TreeViewProvider extends absprovider.TreeViewProviderProjects {

  constructor(f: string[]) {
    super(f);
  }

  public ReloadProject(file: string) : [model.Project[], string[]]{
      
    var sln_name = path.basename(path.dirname(file));
    var root = vscode.workspace.rootPath ? vscode.workspace.rootPath : "./";
    var proj_file = path.join(root, "BuildFiles", "Project.cbp");
    if (!fs.existsSync(proj_file)) {
        return [[],[]];
    }
    var content = fs.readFileSync(proj_file).toString();
    var model_projects: model.Project[] = [];
    var dir_name = path.dirname(file);

    var xml_object = xml.parseString(content, (err, result) => {
        if (!result.hasOwnProperty("CodeBlocks_project_file") ||
            !result.CodeBlocks_project_file.hasOwnProperty("Project") ||
            !result.CodeBlocks_project_file.Project[0].hasOwnProperty("Build") ||
            !result.CodeBlocks_project_file.Project[0].hasOwnProperty("Unit") ||
            !result.CodeBlocks_project_file.Project[0].Build[0].hasOwnProperty("Target"))
            return;

        var targets: any[] = result.CodeBlocks_project_file.Project[0].Build[0].Target;
        var file_units: any[] = result.CodeBlocks_project_file.Project[0].Unit

        var cmake_targets: Map<string, CMakeProject> = new Map<string, CMakeProject>();
        for (var i = 0; i < targets.length; i++) {
            var name = targets[i].$.title;
            var type = "0";
            var out_dir = "";
            var binary = "";
            var includes: string[] = [];
            var flags: string[] = [];
            if (targets[i].hasOwnProperty("Option")) {
                for (var j = 0; j < targets[i].Option.length; j++) {
                    if (targets[i].Option[j].$.hasOwnProperty("type")) {
                        type = targets[i].Option[j].$.type;
                    }

                    if (targets[i].Option[j].$.hasOwnProperty("object_output")) {
                        out_dir = targets[i].Option[j].$.object_output;
                    }

                    if (targets[i].Option[j].$.hasOwnProperty("output")) {
                        binary = targets[i].Option[j].$.output;
                    }
                }
            }
            if (type !== "1" && type !== "2" && type !== "3") {
                continue;
            }

            if (targets[i].hasOwnProperty("Compiler")) {
                var compile = targets[i].Compiler[0];
                for (var j = 0; j < compile.Add.length; j++) {
                    var compile_option = compile.Add[j];
                    if (compile_option.$.hasOwnProperty("directory")) {
                        includes.push(compile_option.$.directory);
                    }

                    if (compile_option.$.hasOwnProperty("option")) {
                        flags.push(compile_option.$.option);
                    }
                }
            }

            var cmake_project = new CMakeProject();
            cmake_project.Flags = flags;
            cmake_project.IncludeDirs = includes;
            cmake_project.OutDir = out_dir;
            cmake_project.Output = binary;
            cmake_project.Title = name;
            switch(type) {
                case "1":
                    cmake_project.Type = "executable";
                    break;
                case "2":
                    cmake_project.Type = "static_library";
                    break;
                case "3":
                    cmake_project.Type = "shared_library";
                    break;
                default:
                    cmake_project.Type = "static_library";
                    break;
            }
            cmake_targets.set(name, cmake_project);
        }

        for (var i = 0; i < file_units.length; i++) {
            var unit = file_units[i];
            var file_name = unit.$.filename;
            var belong_to = "";
            if (unit.hasOwnProperty("Option")) {
                for (var j = 0; j < unit.Option.length; j++) {
                    if (!unit.Option[j].hasOwnProperty("$") || !unit.Option[j].$.hasOwnProperty("target")) {
                        continue;
                    }

                    belong_to = unit.Option[j].$.target;
                    if (belong_to === "") {
                        continue;
                    }

                    if (!cmake_targets.has(belong_to)) {
                        continue;
                    }

                    var cmake_project = cmake_targets.get(belong_to);
                    if (cmake_project) {
                        cmake_project.Files.push(file_name);
                    }
                }
            }
        }

        var project_names = Array.from(cmake_targets.keys());
        for (var i = 0; i < project_names.length; i++) {
            var proj = project_names[i];
            var cmake_proj = cmake_targets.get(proj);
            if (!cmake_proj) {
                continue;
            }
            var proj_path = file;
            var full_name = sln_name + ":" + proj_path + ":" + proj;
            var project_type = new Map<string, string>();
            var project_files = new Map<string, string[]>();
            var project_defines = new Map<string, string[]>();
            var project_includes = new Map<string, string[]>();
            var project_flags = new Map<string, string[]>();
            var project_out_dir = new Map<string, string>();
            var project_out_file = "";
            var project_build = new Map<string, string>();
            var project_clean = new Map<string, string>();

            project_type.set("", cmake_proj.Type);
            project_defines.set("", []);
            project_includes.set("", cmake_proj.IncludeDirs);
            project_flags.set("", cmake_proj.Flags);
            project_out_dir.set("", cmake_proj.OutDir);
            project_out_file = cmake_proj.Output;
            project_build.set("", "cmake --build " + dir_name + "/BuildFiles --target " + proj);
            project_clean.set("", "cmake --build " + dir_name + "/BuildFiles --target clean");

            for (var j = 0; j < cmake_proj.Files.length; j++) {
                var source = cmake_proj.Files[j];
                var group_name = globals.GetFileGroupNameFromFile(source);
                var v = project_files.get(group_name);
                if (v) {
                  v.push(source);
                } else {
                    project_files.set(group_name, [source]);
                }
            }
            
            var project = new model.Project(proj, proj_path, full_name, project_type,
                project_files, project_defines,
                project_includes, project_flags,
                project_out_dir, project_out_file,
                project_build, project_clean, true, true);
            
            model_projects.push(project);
        }

    });
    return [model_projects, []];
  }

  public RefreshProject(file: string) {
      var [proj, config] = this.ReloadProject(file);
      this.projects_ = {}
      this.configs_ = {}
      this.projects_[this.solutions[0]] = proj;
      this.configs_[this.solutions[0]] = []
      this.Refresh();
  }

  protected GetProjects(file: string): [model.Project[], string[]] {
      if (!fs.existsSync(file)) {
          return [[], []];
      }
     return this.ReloadProject(file);
  }
}