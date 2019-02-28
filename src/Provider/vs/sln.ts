import * as fs from "fs";
import * as vcproj from "./vcxproj";

export class Sln {
    private file_ : string;
    private uuid_ : string = "";
    private projects_: vcproj.Project[] = [];

    constructor(file: string) {
        this.file_ = file;
    }

    Parse() : void {
        throw new Error("Not implement");
    }

    GetVcProjects() : vcproj.Project[] {
        throw new Error("Not implement");
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
    throw new Error("Not implement");
}

export function CreateSolution(file: string) : Sln {
    throw new Error("Not implement");
}

export function GetMsbuild() : string {
    throw new Error("Not implement");
}