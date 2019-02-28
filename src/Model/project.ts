import * as path from "path";
import { Task } from "vscode";

class PlatformSpecificConfiguration {
    public MIMode: string = "";
}

class LaunchConfiguration {
    public name: string = "";
    public type: string = "";
    public request: string = "launch";
    public stopAtEntry: boolean = false;
    public program: string = "";
    public args: string[] = [];
    public cwd: string = "${workspaceRoot}";
    public preLaunchTask: string = "";
    public externalConsole: boolean = true;
    public linux: PlatformSpecificConfiguration = new PlatformSpecificConfiguration();
    public osx: PlatformSpecificConfiguration = new PlatformSpecificConfiguration();
}

export class LaunchConfig {
    public version: string = "0.2.0";
    public configurations: LaunchConfiguration[] = []

}

class PropertyConfiguration {
    public name: string = "";
    public includePath: string[] = [];
    public defines: string[] = [];
    public cStandard: string = "c99";
    public cppStandard: string = "c++11";
    public intelliSenseMode: string = "clang-x64";
}

export class PropertyConfig {
    public configurations: PropertyConfiguration[] = []
    public version = 4;
}

class BuildGroup {
    public kind: string = "";
    public isDefault: boolean = false;
}
export class BuildTask {
    public label: string = "";
    public type: string = "shell";
    public command: string = "";
    public group : BuildGroup = new BuildGroup();
}

export class BuildConfig {
    public tasks: BuildTask[] = [];
    public version: string = "2.0.0";
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
    private raw_files_ : string[] = []
    private defines_: string[];
    private include_dirs_: string[];
    private build_command_: string;
    private clean_command_: string;
    private root_dir_: string;
    private binary_: string;
    private cpp_standard: string = "11";
    private c_standard: string = "99";
    constructor(name: string,
                full_name: string,
                project_type: string,
                files : Map<string, string[]>,
                defines: string[],
                include_dirs: string[],
                compile_flags: string[],
                root_dir: string,
                binary: string,
                build_command: string,
                clean_command: string) {
        super(name, full_name);
        this.files_ = files;
        this.defines_ = defines;
        this.include_dirs_ = include_dirs;
        this.build_command_ = build_command;
        this.clean_command_ = clean_command;
        this.project_type_ = project_type;
        this.root_dir_ = root_dir;
        this.binary_ = binary;
        this.files_.forEach((value, key, self) => {
            value.forEach((file, index, self)=> {
                this.raw_files_.push(file)
            });
        });

        this.ParseCompileFlags(compile_flags);
    }

    private ParseCompileFlags(flags: string[]) {
        for(var i = 0; i < flags.length; i++) {
            var flag = flags[i];
            if (flag.startsWith("-I") ||flag.startsWith("/I")) {
                if (flag === "-I" || flag === "/I") {
                    i++;
                    this.include_dirs_.push(flags[i]);
                } else {
                    this.include_dirs_.push(flag.substr(2));
                }
                continue;
            }

            if (flag.startsWith("-D") ||flag.startsWith("/D")) {
                if (flag === "-D" || flag === "/D") {
                    i++;
                    this.defines_.push(flags[i]);
                } else {
                    this.defines_.push(flag.substr(2));
                }
                continue;
            }

            if (flag === "-isystem") {
                i++;
                this.include_dirs_.push(flags[i]);
                continue;
            }

            if (flag.startsWith("-std=c++")) {
                this.cpp_standard = flag.substr(8);
                continue;
            }

            if (flag.startsWith("-std=gnu++")) {
                this.cpp_standard = flag.substr(10);
                continue;
            }

            if (flag.startsWith("-std=c")) {
                this.c_standard = flag.substr(6);
                continue;
            }

            if (flag.startsWith("-std=gnu")) {
                this.c_standard = flag.substr(8);
                continue;
            }
        }
    }

    GetType() {
        return this.project_type_;
    }

    GetLaunchConfig() : LaunchConfiguration | undefined{
        if (this.project_type_ !== "executable") {
            return undefined;
        }
        var config: LaunchConfiguration = new LaunchConfiguration();
        config.name = this.GetName();
        if (process.platform === "win32") {
            config.type = "cppvsdbg";
        } else {
            config.type = "cppdbg";
        }
        config.program = this.binary_;
        config.cwd = this.root_dir_;
        config.preLaunchTask = "Build " + this.GetFullName();
        config.linux.MIMode = "gdb";
        config.osx.MIMode = "lldb";
        return config;
    }

    GetPropertyConfig() : PropertyConfig{
        var property = new PropertyConfig();
        var config = new PropertyConfiguration();
        config.name = this.GetFullName();
        config.includePath = this.GetIncludePathes();
        config.defines = this.GetDefiles();
        config.cStandard = "c" + this.c_standard;
        config.cppStandard = "c++" + this.cpp_standard;
        property.configurations.push(config);
        return property;
    }

    GetBuildTask() : BuildTask {
        var task =  new BuildTask();
        task.label = "Build " + this.GetFullName();
        task.command = this.build_command_;
        task.group.isDefault = false;
        task.group.kind = "build";
        return task;
    }

    GetCleanTask() : BuildTask {
        var task =  new BuildTask();
        task.label = "Clean " + this.GetFullName();
        task.command = this.clean_command_;
        task.group.isDefault = false;
        task.group.kind = "build";
        return task;
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

    GetFiles() {
        return this.raw_files_;
    }


}


