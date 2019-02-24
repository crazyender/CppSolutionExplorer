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
        if (!fs.existsSync(file))
            return projects;

        var gn_obj : any = JSON.parse(fs.readFileSync(file).toString());
        var gn_targets = Object.keys(gn_obj.targets)
        var gn_args = Object.keys(gn_obj.args) 
        for (var i = 0; i < gn_targets.length; i++) {
            var gn_target_name = gn_targets[i];
            var gn_target_obj = gn_obj.targets[gn_target_name]
            if (!this.ValidTarget(gn_target_obj))
                continue
            var name = gn_target_name
            if (name.lastIndexOf(":") != -1) {
                var parts = gn_target_name.split(":")
                name = parts[parts.length - 1]
            }
            var project = new model.Project(name,
                                path.basename(file) + ":" + gn_target_name,
                                this.GetType(gn_target_obj),
                                this.GetSources(gn_target_obj),
                                this.GetDefiles(gn_target_obj),
                                this.GetIncludePath(gn_target_obj),
                                this.GetBuildCommand(gn_target_obj)
            );
            projects.push(project);
        }
        return projects;
    }

    private GetSources(gn_target_obj: any): Map<string, string[]> {
        var ret: Map<string, string[]> = new Map<string, string[]>()
        var sources: string[] = []
        if (gn_target_obj.hasOwnProperty("sources")) {
            sources = sources.concat(gn_target_obj.sources)
        }

        if (gn_target_obj.hasOwnProperty("inputs")) {
            sources = sources.concat(gn_target_obj.inputs)
        }

        for (var i = 0; i < sources.length; i++) {
            var source = sources[i]
            var group_name = absprovider.GetFileGroupNameFromFile(source)
            var v = ret.get(group_name)
            if (v) v.push(source)
            else {
                ret.set(group_name, [source])
            }
        }
        return ret;
        
    }

    private GetDefiles(gn_target_obj: any) {
        if (gn_target_obj.hasOwnProperty("defines")) {
            return gn_target_obj.defines
        }
        return []
    }

    private GetIncludePath(gn_target_obj: any) {
        if (gn_target_obj.hasOwnProperty("include_dirs")) {
            return gn_target_obj.include_dirs
        }
        return []
    }

    private GetBuildCommand(gn_target_obj: any) {
        return "FIXME"
    }


    private GetType(gn_target_obj: any) {
        return gn_target_obj.type
    }

    private ValidTarget(gn_target_obj: any) : boolean {
        var t = this.GetType(gn_target_obj)
        if (t === "static_library" || t === "source_set" ||
            t === "shared_library" || t === "loadable_module" ||
            t === "executable") {
            return this.GetSources(gn_target_obj).size != 0
        } else if (t === "action_foreach") {
            return this.GetSources(gn_target_obj).size != 0
        } else {
            return false
        }
    }

}