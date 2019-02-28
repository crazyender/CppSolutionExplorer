import * as vscode from "vscode";
import * as fs from "fs";
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
        throw new Error("Not implement");
    }

}