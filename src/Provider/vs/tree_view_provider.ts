import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as absprovider from "../project_view_provider";
import * as model from "../../Model/project";
import * as sln from "./sln";

export class TreeViewProvider extends absprovider.TreeViewProviderProjects {

    protected GetProjects(file: string): model.Project[] {
        var projects : model.Project[] = [];
        if (!fs.existsSync(file)) {
            return projects;
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
    
            var p = new model.Project(
                proj.GetName(),
                path.basename(file) + ":" + proj.GetPath(),
                "static_library",
                proj_files,
                proj.GetDefines(""),
                proj.GetIncludeDirs(""),
                proj.GetCompileFlags(""),
                "",
                "",
                "",
                ""
            );
            projects.push(p);
        });
        return projects;
    }

}