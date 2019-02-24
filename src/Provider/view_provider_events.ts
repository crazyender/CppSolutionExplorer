import * as vscode from "vscode"
import * as view from "../View/item"

export class TreeViewProviderProjectsEvents {
    public static all_opened_doc : Map<string, view.ProjectViewItem> = new Map<string, view.ProjectViewItem>()
    constructor() {
        vscode.window.onDidChangeActiveTextEditor( e => {
            if (!e) return;
            vscode.commands.executeCommand("CppSolutionExplorer.ChangeConfig")
        });

        
    }
}