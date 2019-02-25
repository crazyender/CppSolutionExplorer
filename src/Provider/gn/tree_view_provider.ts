import * as vscode from "vscode";
import * as fs from "fs"
import * as path from "path"
import * as absprovider from "../project_view_provider";
import * as model from "../../Model/project";

export class TreeViewProvider extends absprovider.TreeViewProviderProjects {
    private gn_file_content = undefined
    constructor(f: string[]) {
        super(f);
    }
    protected GetProjects(file: string): model.Project[] {
        var projects : model.Project[] = [];
        if (!fs.existsSync(file)) {
            return projects;
        }

        var gn_obj : any = JSON.parse(fs.readFileSync(file).toString());
        var gn_targets = Object.keys(gn_obj.targets);
        var gn_args = Object.keys(gn_obj.args) ;
        for (var i = 0; i < gn_targets.length; i++) {
            var gn_target_name = gn_targets[i];
            var gn_target_obj = gn_obj.targets[gn_target_name];
            if (!this.ValidTarget(gn_target_obj)) {
                continue;
            }
            var name = gn_target_name;
            if (name.lastIndexOf(":") !== -1) {
                var parts = gn_target_name.split(":");
                name = parts[parts.length - 1];
            }

            var project = new model.Project(name,
                                path.basename(file) + ":" + gn_target_name,
                                this.GetType(gn_target_obj),
                                this.GetSources(gn_target_obj),
                                this.GetDefiles(gn_target_obj),
                                this.GetIncludePath(gn_target_obj),
                                this.GetWorkDir(gn_target_obj),
                                this.GetBinaryName(gn_target_obj),
                                this.GetBuildCommand(gn_target_obj),
                                this.GetCleanCommand(gn_target_obj)
            );
            projects.push(project);
        }
        return projects;
    }

    private GetSources(gn_target_obj: any): Map<string, string[]> {
        var ret: Map<string, string[]> = new Map<string, string[]>()
        var sources: string[] = [];
        if (gn_target_obj.hasOwnProperty("sources")) {
            sources = sources.concat(gn_target_obj.sources);
        }

        if (gn_target_obj.hasOwnProperty("inputs")) {
            sources = sources.concat(gn_target_obj.inputs)
        }

        for (var i = 0; i < sources.length; i++) {
            var source = sources[i]
            var group_name = absprovider.GetFileGroupNameFromFile(source)
            var v = ret.get(group_name)
            if (v) {
                v.push(source)
            } else {
                ret.set(group_name, [source])
            }
        }

        return ret;
        
    }

    private GetDefiles(gn_target_obj: any) {
        if (gn_target_obj.hasOwnProperty("defines")) {
            return gn_target_obj.defines;
        }
        return [];
    }

    private GetIncludePath(gn_target_obj: any) {
        if (gn_target_obj.hasOwnProperty("include_dirs")) {
            return gn_target_obj.include_dirs;
        }
        return [];
    }

    private GetWorkDir(gn_target_obj: any) {
        var work_dir : string = "./";
        if (gn_target_obj.hasOwnProperty("build_dir")) {
            work_dir = gn_target_obj.build_dir;
        }
        return work_dir;
    }

    private GetBinaryName(gn_target_obj: any) {
        var target : string = "";
        if (gn_target_obj.hasOwnProperty("dependency_output_file")) {
            target = gn_target_obj.dependency_output_file;
        }
        return target;
    }

    private GetBuildCommand(gn_target_obj: any) {
        var ninja : string = "ninja";
        if (gn_target_obj.hasOwnProperty("ninja_path")) {
            ninja = gn_target_obj.ninja_path;
        }
        var work_dir = this.GetWorkDir(gn_target_obj);
        var target = this.GetBinaryName(gn_target_obj);
        return ninja + " -C " + work_dir + " " + target;
    }

    private GetCleanCommand(gn_target_obj: any) {
        var ninja : string = "ninja";
        if (gn_target_obj.hasOwnProperty("ninja_path")) {
            ninja = gn_target_obj.ninja_path;
        }
        var work_dir = this.GetWorkDir(gn_target_obj);
        var target = this.GetBinaryName(gn_target_obj);
        return ninja + " -C " + work_dir + " -t clean " + target;
    }


    private GetType(gn_target_obj: any) {
        return gn_target_obj.type
    }

    private ValidTarget(gn_target_obj: any) : boolean {
        var t = this.GetType(gn_target_obj)
        if (t === "static_library" || t === "source_set" ||
            t === "shared_library" || t === "loadable_module" ||
            t === "executable") {
            return this.GetSources(gn_target_obj).size !== 0;
        } else if (t === "action_foreach") {
            return this.GetSources(gn_target_obj).size !== 0;
        } else {
            return false;
        }
    }

}