import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as absprovider from "../project_view_provider";
import * as model from "../../Model/project";
import * as sln from "./sln";

export class TreeViewProvider extends absprovider.TreeViewProviderProjects {

    
    protected GetProjects(file: string): [model.Project[], string[]] {
        var projects : model.Project[] = [];
        if (!fs.existsSync(file)) {
            return [[], []];
        }

        // I don't like nested projects (project under folder), so I will not implement them
        var solution = sln.ReadSolution(file);
        var vcprojects = solution.GetVcProjects();

        
        vcprojects.forEach((proj, index, self) => {
            var proj_files: Map<string, string[]> = new Map<string, string[]>();
            var sources = proj.GetFiles();
            sources = sources.filter((file, index, self)=> {
                var ext = path.extname(file);
                if (ext === ".c" || ext === ".cpp" || ext === ".cc" ||
                    ext === ".cxx" || ext === ".h" || ext === ".hh" ||
                    ext === ".hpp" || ext === ".m" || ext === ".mm" ||
                    ext === ".java") {
                        return true;
                    }
                return false;
            });
    
            for (var i = 0; i < sources.length; i++) {
                var source = sources[i];
                var group_name = absprovider.GetFileGroupNameFromFile(source);
                var v = proj_files.get(group_name);
                if (v) {
                    v.push(source);
                } else {
                    proj_files.set(group_name, [source]);
                }
            }

            var defines = new Map<string, string[]>();
            var includes = new Map<string, string[]>();
            var flags = new Map<string, string[]>();
            var build_commands = new Map<string, string>();
            var clean_commands = new Map<string, string>();
            var configs = solution.GetConfigurations();
            for (var i = 0; i < configs.length; i++) {
                var config = configs[i];
                var proj_config = solution.GetProjectConfigName(proj.GetUUID(), config);
                defines.set(config, proj.GetDefines(proj_config));
                includes.set(config, proj.GetIncludeDirs(proj_config));
                flags.set(config, proj.GetCompileFlags(proj_config));
                build_commands.set(config, "");
                clean_commands.set(config, "");
            }
    
            var p = new model.Project(
                proj.GetName(),
                path.basename(file) + ":" + proj.GetPath(),
                "static_library",
                proj_files,
                defines,
                includes,
                flags,
                "",
                "",
                build_commands,
                clean_commands
            );
            projects.push(p);
        });
        return [projects, solution.GetConfigurations()];
    }

}