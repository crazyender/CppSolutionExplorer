import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as gn from "../Provider/gn/tree_view_provider";
import * as vs from "../Provider/vs/tree_view_provider";
import * as Null from "../Provider/null/tree_view_provider";
import * as command from "./view_provider_commands"
import * as event from "./view_provider_events"

/**
* GetProvider
*  Get tree view based on special files under root folder
* 
* @param:   None
* @return:  None
*/
export function CreateTreeView() {
    var root_path = vscode.workspace.rootPath ? vscode.workspace.rootPath : "./";
    var provider = null;

    var gn_files : string[] = [];
    var sln_files : string[] = [];
    fs.readdirSync(root_path).forEach(file => {
        var full_path = path.join(root_path, file);
        var ext = path.extname(full_path);
        if (ext === ".sln") {
            sln_files.push(full_path);
        }

        if (ext === ".json") {
            gn_files.push(full_path)
        }
    });

    if (gn_files.length) {
        return new gn.TreeViewProvider(gn_files)
    } else if (sln_files.length) {
        return new vs.TreeViewProvider(sln_files)
    } else {
        return new Null.TreeViewProvider([])
    }

}

export function RegisterCommand(provider: any) : any {
    var c = new command.TreeViewProviderProjectsCommands(provider)
    c.Register()
    return c
}

export function RegisterEvents() : any {
    var c = new event.TreeViewProviderProjectsEvents()
    return c
}