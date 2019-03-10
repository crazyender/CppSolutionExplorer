import * as vscode from "vscode";
import * as view from "../View/item";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as cmake from "../Provider/cmake/tree_view_provider";

export class TreeViewProviderProjectsEvents {
    public static all_opened_doc : {[id: string] : view.ProjectViewItem;} = {};
    constructor() {
        vscode.window.onDidChangeActiveTextEditor( e => {
            if (!e) {return;}
            vscode.commands.executeCommand("CppSolutionExplorer.ChangeConfig");
        });

        
    }
}

export function WatchProject(root_path: string, provider: cmake.TreeViewProvider) {
    if (!fs.existsSync(root_path)) {
        fs.mkdirSync(root_path);
    }

    var file_path = path.join(root_path, "BuildFiles");
    if (!fs.existsSync(file_path)) {
        fs.mkdirSync(file_path);
    }

    var watch_file = path.join(file_path, "Project.cbp");
    var cmake_file = path.join(root_path, "CMakeLists.txt");
    fs.watch(file_path, {}, (e, file) => {
        if (file === "Project.cbp") {
            if (fs.existsSync(watch_file)) {
                provider.RefreshProject(cmake_file);
            }
        }
    });

    fs.watch(cmake_file, {}, (e, f) => {
        if (e === "change") {
            vscode.commands.executeCommand("CppSolutionExplorer.GenerateCMake");
        }
    });
}


function DigestPath(input: string) : string{
    return crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex');
}

export function AddFileCache(file: string, v: view.ProjectViewItem) : void {
    var full_path = file.split("\\").join("/").trim();
    if (process.platform === "win32") {
        full_path = full_path.toLowerCase();
    }
    TreeViewProviderProjectsEvents.all_opened_doc[full_path] = v;
}

export function GetFileFromCache(file: string) : view.ProjectViewItem | undefined {
    var full_path = file.split("\\").join("/").trim();
    if (process.platform === "win32") {
        full_path = full_path.toLowerCase();
    }
    return TreeViewProviderProjectsEvents.all_opened_doc[full_path];
}