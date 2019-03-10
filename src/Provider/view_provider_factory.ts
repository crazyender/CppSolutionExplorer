import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as gn from "../Provider/gn/tree_view_provider";
import * as vs from "../Provider/vs/tree_view_provider";
import * as cmake from "../Provider/cmake/tree_view_provider";
import * as Null from "../Provider/null/tree_view_provider";
import * as command from "./view_provider_commands";
import * as event from "./view_provider_events";

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
    var cmake_files : string[] = [];
    fs.readdirSync(root_path).forEach(file => {
        var full_path = path.join(root_path, file);
        var ext = path.extname(full_path);

        if (path.basename(full_path) === "CMakeLists.txt") {
            cmake_files.push(full_path);
        }

        if (ext === ".sln") {
            sln_files.push(full_path);
        }

        if (ext === ".json") {
            gn_files.push(full_path);
        }
    });

    if (cmake_files.length) {
        var build_path = path.join(root_path, "BuildFiles");
        if (!fs.existsSync(build_path)) {
            fs.mkdirSync(build_path);
        }
        vscode.commands.executeCommand("CppSolutionExplorer.GenerateCMake");
        provider = new cmake.TreeViewProvider(cmake_files);
        event.WatchProject(root_path, provider)
        return provider;
    } if (gn_files.length) {
        return new gn.TreeViewProvider(gn_files);
    } else if (sln_files.length) {
        return new vs.TreeViewProvider(sln_files);
    } else {
        return new Null.TreeViewProvider([]);
    }

}

export function RegisterCommand(provider: any) : any {
    var c = new command.TreeViewProviderProjectsCommands(provider);
    c.Register();
    return c;
}

export function RegisterEvents() : any {
    var c = new event.TreeViewProviderProjectsEvents();
    return c;
}