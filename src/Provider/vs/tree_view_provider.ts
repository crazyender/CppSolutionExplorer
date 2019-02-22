import * as vscode from "vscode";
import * as absprovider from "../project_view_provider";
import * as model from "../../Model/project";

export class TreeViewProvider extends absprovider.TreeViewProviderProjects {

    protected GetProjects(file: string): model.Project[] {
        throw new Error("Method not implemented.");
    }

}