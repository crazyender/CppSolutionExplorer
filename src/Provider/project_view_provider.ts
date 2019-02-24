import * as vscode from "vscode";
import * as path from "path";
import * as item from "../View/item";
import * as model from "../Model/project";
import * as fs from "fs";


export function GetFileGroupNameFromFile(file: string) : string {
    var ext = path.extname(file)
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
        default:
            return "Object Files";
    }
}

export abstract class TreeViewProviderProjects implements vscode.TreeDataProvider<item.ProjectViewItem> {

    private top_level_item_: item.ProjectViewItem[] = [];

    constructor(files: string[]) {
        var all_projects : Map<string, model.Project[]> = new Map<string, model.Project[]>()
        for(var i = 0; i < files.length; i++) {
            var name = path.basename(files[i])
            var projects = this.GetProjects(files[i])
            all_projects.set(name, projects)
            this.top_level_item_.push(item.CreateTopLevel(name, projects));
        }

        // write launch.json and tasks.json
        var all_launchs : model.LaunchConfig[] = []
        var all_builds : model.BuildConfig[] = []
    }

    protected abstract  GetProjects(root_file: string) : model.Project[];

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