import * as path from "path"

export class LaunchConfig {
    public name: string = ""

}

class configuration {
    public name: string = ""
    public includePath: string[] = []
    public defines: string[] = []
}

export class PropertyConfig {
    public configurations: configuration[] = []
    public version = 4;
}

export class BuildConfig {
    public name: string = ""
}

export abstract class AbsModel {
    private name_: string
    private full_name_: string
    constructor(name:string, full_name:string) {
        this.name_ = name
        this.full_name_ = full_name
    }

    GetName() {
        return this.name_
    }

    GetFullName() {
        return this.full_name_
    }
}

export class Null extends AbsModel {
    constructor() {
        super("", "")
    }
}

export class File extends AbsModel{
    constructor(full_path: string) {
        super(path.basename(full_path), full_path)
    }

}

export class FileGroup  extends AbsModel{
    private files_: string[];
    constructor(name: string, files: string[]) {
        super(name, "")
        this.files_ = files.sort();
    }


    GetFiles() {
        var ret : File[] = []
        for (var i = 0; i < this.files_.length; i++) {
            ret.push(new File(this.files_[i]))
        }
        return ret
    }

}

export class Project  extends AbsModel{
    private project_type_: string
    private files_: Map<string, string[]>
    private defines_: string[];
    private include_dirs_: string[];
    private build_command_: string;
    constructor(name: string,
                full_name: string,
                project_type: string,
                files : Map<string, string[]>,
                defines: string[],
                include_dirs: string[],
                build_command: string) {
        super(name, full_name)
        this.files_ = files
        this.defines_ = defines
        this.include_dirs_ = include_dirs
        this.build_command_ = build_command
        this.project_type_ = project_type
    }

    GetType() {
        return this.project_type_
    }

    GetLaunchConfig(name: string) : LaunchConfig{
        return new LaunchConfig()
    }

    GetPropertyConfig() : PropertyConfig{
        var property = new PropertyConfig()
        var config = new configuration()
        config.name = this.GetFullName()
        config.includePath = this.GetIncludePathes()
        config.defines = this.GetDefiles()
        property.configurations.push(config)
        return property
    }

    GetBuildConfig(name: string) : BuildConfig {
        return new BuildConfig()
    }

    GetGroups() {
        var ret : FileGroup[] = []
        var file_groups = Array.from(this.files_.keys()).sort()
        for (var i = 0; i < file_groups.length; i++) {
            var group_name = file_groups[i]
            var full_pathes = this.files_.get(group_name)
            ret.push(new FileGroup(group_name, full_pathes ? full_pathes : []));
        }
        return ret
    }

    GetDefiles() {
        return this.defines_;
    }

    GetIncludePathes() {
        return this.include_dirs_;
    }


}


