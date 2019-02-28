import * as xml from "xml2js"
import * as fs from "fs";

export class Project {
    GetUUID(): string {
        throw new Error("Not implement");
    }

    SetUUID(uuid: string) {
        throw new Error("Not implement");
    }

    Save() : void {
        throw new Error("Not implement");
    }

    AddFile(file: string) {
        throw new Error("Not implement");
    }

    RemoveFile(file: string, permanent: boolean) {
        throw new Error("Not implement");
    }

    GetDefines(config: string | undefined) : string[] {
        throw new Error("Not implement");
    }

    SetDefines(config: string | undefined, defines: string[]) {
        throw new Error("Not implement");
    }


    GetIncludeDirs(config: string | undefined) : string[] {
        throw new Error("Not implement");
    }

    SetIncludeDirs(config: string | undefined, includes: string[]) {
        throw new Error("Not implement");
    }

    GetLibDirs(config: string | undefined) : string[] {
        throw new Error("Not implement");
    }

    SetLibDirs(config: string | undefined, dirs: string[]) {
        throw new Error("Not implement");
    }

    GetCompileFlags(config: string | undefined) : string[] {
        throw new Error("Not implement");
    }

    SetCompileFlags(config: string | undefined, flags: string[]) {
        throw new Error("Not implement");
    }

    GetLinkFlags(config: string | undefined) : string[] {
        throw new Error("Not implement");
    }

    SetLinkFlags(config: string | undefined, flags: string[]) {
        throw new Error("Not implement");
    }

    GetIntermediatePath(config: string | undefined) : string {
        throw new Error("Not implement");
    }

    SetIntermediatePath(config: string | undefined, path: string) {
        throw new Error("Not implement");
    }

    GetOutputPath(config: string | undefined) : string {
        throw new Error("Not implement");
    }

    SetOutputPath(config: string | undefined, path: string) {
        throw new Error("Not implement");
    }
}

export function ReadProject(file: string) : Project {
    throw new Error("Not implement");
}

export function CreateProject(file: string) : Project {
    throw new Error("Not implement");
}