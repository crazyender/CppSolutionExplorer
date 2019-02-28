import * as vscode from "vscode";
import * as view from "../View/item";
import * as crypto from "crypto";

export class TreeViewProviderProjectsEvents {
    public static all_opened_doc : {[id: string] : view.ProjectViewItem;} = {};
    constructor() {
        vscode.window.onDidChangeActiveTextEditor( e => {
            if (!e) {return;}
            vscode.commands.executeCommand("CppSolutionExplorer.ChangeConfig");
        });

        
    }
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