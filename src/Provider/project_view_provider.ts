import * as vscode from "vscode";
import * as path from "path";
import * as item from "../View/item";
import * as model from "../Model/project";
import * as global from "../utils/globals";
import * as fs from "fs";


export function GetFileGroupNameFromFile(file: string) : string {
    var ext = path.extname(file);
    switch (ext) {
        case ".c":
        case ".cc":
        case ".cxx":
        case ".cpp":
        case ".m":
        case ".mm":
            return "Source Files";
        case ".h":
        case ".hh":
        case ".hpp":
        case ".hxx":
            return "Header Files";
        case ".java":
            return "Java Files";
        default:
            return "Object Files";
    }
}

export abstract class TreeViewProviderProjects implements vscode.TreeDataProvider<item.ProjectViewItem> {

    private top_level_item_: item.ProjectViewItem[] = [];

    constructor(files: string[]) {
        // write launch.json and tasks.json
        var all_launchs : model.LaunchConfig = new model.LaunchConfig();
        var all_builds : model.BuildConfig = new model.BuildConfig();

        for(var i = 0; i < files.length; i++) {
            var name = path.basename(files[i]);
            var [projects, configs] = this.GetProjects(files[i]);
            projects.forEach((value, index, self) => {
                all_builds.tasks.push(value.GetBuildTask());
                all_builds.tasks.push(value.GetCleanTask());
                
                var launch = value.GetLaunchConfig();
                if (launch) {
                    all_launchs.configurations.push(launch);
                }
            });

            var sln_name = name;
            var ext = path.extname(sln_name);
            if (ext !== "") {
                sln_name = sln_name.replace(ext, "");
            }

            this.top_level_item_.push(item.CreateTopLevel(sln_name, projects, configs));
            if (configs.length !== 0 && global.GlobalVarients.selected_config === "") {
                global.GlobalVarients.selected_config = configs[0];
            } else {
                global.GlobalVarients.selected_config = "";
            }
        }

        var json_root = vscode.workspace.rootPath ? vscode.workspace.rootPath : "./";
        json_root = path.join(json_root, ".vscode");
        if (!fs.existsSync(json_root)) {
            fs.mkdirSync(json_root);
        }
        var tasks = path.join(json_root, "tasks.json");
        if (fs.existsSync(tasks)) {
            fs.unlinkSync(tasks);
        }
        var launch = path.join(json_root, "launch.json");
        if (fs.existsSync(launch)) {
            fs.unlinkSync(launch);
        }
        
        fs.writeFile(tasks, JSON.stringify(all_builds, undefined, "  "), (err) => {
            fs.writeFile(launch, JSON.stringify(all_launchs, undefined, "  "), (err) => {
            });
        });

    }

    protected abstract  GetProjects(root_file: string) : [model.Project[], string[]];

    getTreeItem(element: item.ProjectViewItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: item.ProjectViewItem | undefined): vscode.ProviderResult<item.ProjectViewItem[]> {
        if (element) {
            return element.GetChildren();
        } else {
            return this.top_level_item_;
        }
    }

    getParent?(element: item.ProjectViewItem | undefined): vscode.ProviderResult<item.ProjectViewItem> {
        if(!element) { return undefined; }
        return element.GetParent();
    }

}