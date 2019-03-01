import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as vcproj from "./vcxproj";

export class Sln {
    private file_ : string;
    private uuid_ : string = "";
    private projects_: vcproj.Project[] = [];

    constructor(file: string) {
        this.file_ = file;
    }

    Parse() : void {
        var lines = fs.readFileSync(this.file_).toString().split("\n");
        lines.forEach((line, index, self) => {
            var l = line.trim();
            if (l.startsWith("Project")) {
                var contents = l.split(",");
                var name = contents[0];
                var file_path = contents[1].trim();
                var uuid = contents[2].trim();
                name = name.split("=")[1].trim();
                name = name.substr(1, name.length - 2);
                file_path = file_path.substr(1, file_path.length - 2);
                file_path = path.join(vscode.workspace.rootPath ? vscode.workspace.rootPath : "./", file_path);
                uuid = uuid.substr(1, uuid.length - 2);
                if (file_path.endsWith("vcxproj")) {
                    var project = new vcproj.Project(name, file_path, uuid);
                    project.Parse();
                    this.projects_.push(project);
                }

            }
        });
    }

    GetVcProjects() : vcproj.Project[] {
        return this.projects_;
    }

    AddProject(project: vcproj.Project) {
        throw new Error("Not implement");
    }

    RemoveProject(uuid: string, permanent: boolean) {
        throw new Error("Not implement");
    }

    GetConfigurations() : string[] {
        throw new Error("Not implement");
    }

    AddConfigurations(copy_from: string | undefined) : void {
        throw new Error("Not implement");
    }

    GetUUID(): string {
        return this.uuid_;
    }

    SetUUID(uuid: string): void {
        this.uuid_ = uuid;
    }

    Save() : void {
        throw new Error("Not implement");
    }
}

export function ReadSolution(file: string) : Sln {
    var sln = new Sln(file);
    sln.Parse();
    return sln
}

export function CreateSolution(file: string) : Sln {
    throw new Error("Not implement");
}

export function GetMsbuild() : string {
    throw new Error("Not implement");
}