import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as vcproj from "./vcxproj";

class ProjectConfigMap {
    public UUID : string;
    public SolutionConfigName : string;
    public ProjectConfigName : string;
    constructor(uuid : string, solution : string, project : string) {
        this.UUID = uuid;
        this.SolutionConfigName = solution;
        this.ProjectConfigName = project;
    }
}


export class Sln {
    private file_ : string;
    private uuid_ : string = "";
    private projects_: vcproj.Project[] = [];
    private solution_configs : string[] = [];
    private project_configs: ProjectConfigMap[] = [];

    constructor(file: string) {
        this.file_ = file;
    }

    GetProjectConfigName(uuid: string, solution_config_name: string) {
        var ret : string = "";

        this.project_configs.forEach((v, index, self) => {
            if (v.UUID === uuid && v.SolutionConfigName === solution_config_name) {
                ret = v.ProjectConfigName;
            }
        });
        return ret;
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
            } else if (l.startsWith("GlobalSection(SolutionConfigurationPlatforms)")) {
                var type = l.split("=")[1].trim();
                var i = 0;
                var ll = "";
                if (type === "preSolution") {
                    for (i = index + 1; ; i++) {
                        ll = lines[i].trim();
                        if (ll.startsWith("EndGlobalSection")) {
                            break;
                        }
                        var config_name = ll.split("=")[1].trim();
                        this.solution_configs.push(config_name);
                    }
                }
            } else if (l.startsWith("GlobalSection(ProjectConfigurationPlatforms)")) {
                var type = l.split("=")[1].trim();
                var i = 0;
                var ll = "";
                if (type === "postSolution") {
                    for (i = index + 1; ; i++) {
                        ll = lines[i].trim();
                        if (ll.startsWith("EndGlobalSection")) {
                            break;
                        }
                        var project_config = ll.split("=")[1].trim();
                        var project_property = ll.split("=")[0].trim();
                        var project_properties = project_property.split(".");
                        if (project_properties[2] === "ActiveCfg") {
                            var project_uuid = project_properties[0];
                            var solution_config = project_properties[1];
                            this.project_configs.push(new ProjectConfigMap(project_uuid, solution_config, project_config));
                        }
                    }
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
        return this.solution_configs;
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
    return sln;
}

export function CreateSolution(file: string) : Sln {
    throw new Error("Not implement");
}

export function GetMsbuild() : string {
    throw new Error("Not implement");
}