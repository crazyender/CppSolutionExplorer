import * as xml from "xml2js"
import * as fs from "fs";
import * as path from "path";

class ProjectConfiguration {
    private name_ : string;
    private platform_: string;
    private configuration_: string;

    constructor(obj: any) {
        this.name_ = obj.$.Include;
        this.platform_ = obj.Platform[0];
        this.configuration_ = obj.Configuration[0];
    }

    GetName() {
        return this.name_;
    }

    SetName(name: string) {
        this.name_ = name;
    }

    GetPlatform() {
        return this.platform_;
    }

    SetPlatform(platform : string) {
        this.platform_ = platform;
    }

    GetConfiguration() {
        return this.configuration_;
    }

    SetConfiguration(conf: string) {
        this.configuration_ = conf;
    }


}

class CompileSource {
    private file_: string;

    constructor(file_path: string, obj: any) {
        var file = obj.$.Include;
        if (file.startsWith("/") || (file.length >= 2 && file[1] == ":")) {
            this.file_ = file;
        } else {
            this.file_ = path.join( path.dirname(file_path), file );
        }
    }

    GetFile() {
        return this.file_;
    }

    SetFile(file: string) {
        this.file_ = file;
    }
}

class ClCompile extends CompileSource{

}

class ClInclude extends CompileSource{

}

class CustomBuild extends CompileSource{

}

class None extends CompileSource{

}

class ItemGroup {
    private project_configs : ProjectConfiguration[]  = [];
    private compile_sources: CompileSource[] = [];
    private file_path_ : string;

    constructor(file: string, object: any | undefined) {
        this.file_path_ = file;
        if (object) {
            this.Parse(object);
        }
    }

    public GetSources() {
        return this.compile_sources;
    }

    public AddSource(v : CompileSource) {
        this.compile_sources.push(v);
    }

    public RemoveSource(source: CompileSource) {
        this.compile_sources = this.compile_sources.filter((v, index, self) => {
            return v !== source;
        });
    }


    private Parse(proj: any) {
        if (!proj.hasOwnProperty("ItemGroup")) {
            return;
        }

        proj.ItemGroup.forEach((obj:any, index:any, self:any) => {
            if (obj.hasOwnProperty("$") && obj.$.Label === "ProjectConfigurations") {
                if (obj.hasOwnProperty("ProjectConfiguration")) {
                    for (var i = 0; i < obj.ProjectConfiguration.length; i++) {
                        this.project_configs.push(new ProjectConfiguration(obj.ProjectConfiguration[i]));
                    }
                }
    
            } else {
    
                if (obj.hasOwnProperty("ClCompile")) {
                    for (var i = 0; i < obj.ClCompile.length; i++) {
                        this.compile_sources.push(new ClCompile(this.file_path_, obj.ClCompile[i]));
                    }
                }
    
                if (obj.hasOwnProperty("CustomBuild")) {
                    for (var i = 0; i < obj.CustomBuild.length; i++) {
                        this.compile_sources.push(new CustomBuild(this.file_path_, obj.CustomBuild[i]));
                    }
                }
    
                if (obj.hasOwnProperty("ClInclude")) {
                    for (var i = 0; i < obj.ClInclude.length; i++) {
                        this.compile_sources.push(new ClInclude(this.file_path_, obj.ClInclude[i]));
                    }
                }
    
                if (obj.hasOwnProperty("None")) {
                    for (var i = 0; i < obj.None.length; i++) {
                        this.compile_sources.push(new None(this.file_path_, obj.None[i]));
                    }
                }
            }
        });
    }
}


class CompileConfig {
    public AdditionalIncludeDirectories: string[] = [];
    public PreprocessorDefinitions: string[] = [];
    public AdditionalOptions: string[] = [];
    public WarningLevel: string = "Level3";
    public RuntimeLibrary: string = "";
    public Optimization: string = "";
    public file_path : string = "";

    constructor(file: string, obj: any | undefined) {
        if (!obj) {
            return;
        }

        this.file_path = file;

        if (obj.hasOwnProperty("AdditionalIncludeDirectories")) {
            var includes = obj.AdditionalIncludeDirectories[0];
            includes = includes.split("%(AdditionalIncludeDirectories)").join("")
            includes = includes.split("\\").join("/");
            var values = includes.split(";") as string[];
            values = values.map((v, index, self) => {
                if (v.startsWith("/") || (v.length >= 2 && v[1] == ":")) {
                    return v;
                } else {
                    return path.join( path.dirname(this.file_path), v );
                }
            });
            this.AdditionalIncludeDirectories = this.AdditionalIncludeDirectories.concat(values);
        }

        if (obj.hasOwnProperty("PreprocessorDefinitions")) {
            var defines = obj.PreprocessorDefinitions[0];
            defines = defines.split("%(PreprocessorDefinitions)").join("")
            defines = defines.split("\\").join("/");
            this.PreprocessorDefinitions = this.PreprocessorDefinitions.concat(defines.split(";"));
        }

        if (obj.hasOwnProperty("AdditionalOptions")) {
            var flags = obj.AdditionalOptions[0];
            flags = flags.split("%(AdditionalOptions)").join("")
            flags = flags.split("\\").join("/");
            this.AdditionalOptions = this.AdditionalOptions.concat(flags.split(" "));
        }

        if (obj.hasOwnProperty("WarningLevel")) {
            this.WarningLevel = obj.WarningLevel[0];
        }

        if (obj.hasOwnProperty("RuntimeLibrary")) {
            this.RuntimeLibrary = obj.RuntimeLibrary[0];
        }

        if (obj.hasOwnProperty("Optimization")) {
            this.Optimization = obj.Optimization[0];
        }
    }
}

class LinkConfig {
    public SubSystem: string = "";
    public GenerateDebugInformation: string = "true";
    constructor(obj: any | undefined) {
        if (!obj) {
            return;
        }

        if (obj.hasOwnProperty("SubSystem")) {
            this.SubSystem = obj.SubSystem[0];
        }

        if (obj.hasOwnProperty("GenerateDebugInformation")) {
            this.GenerateDebugInformation = obj.GenerateDebugInformation[0];
        }
    }
}


class ItemDefinitionGroup {
    public Condition: string = "";
    public CompileConfig : CompileConfig = new CompileConfig("", undefined);
    public LinkConfig : LinkConfig = new LinkConfig(undefined);
    public file_path : string = "";

    constructor(file: string, obj: any) {
        this.file_path = file;

        if (obj.hasOwnProperty("$") && obj.$.hasOwnProperty("Condition")) {
            var condition = obj.$.Condition as string;
            condition = condition.split("==")[1];
            this.Condition = condition.substr(1, condition.length - 2);
        } else {
            this.Condition = "";
        }

        if (obj.hasOwnProperty("ClCompile")) {
            this.CompileConfig = new CompileConfig(file, obj.ClCompile[0]);
        }

        if (obj.hasOwnProperty("Link")) {
            this.LinkConfig = new LinkConfig(obj.Link[0]);
        }    
    }
}

export class Project {
    private name_: string;
    private path_: string;
    private uuid_: string;
    private item_group: ItemGroup | undefined;
    // condition => ItemDefinitionGroup
    private item_definition_group : Map<string, ItemDefinitionGroup> = new Map<string, ItemDefinitionGroup>();

    constructor(name: string, path: string, uuid: string) {
        this.name_ = name;
        this.path_ = path;
        this.uuid_ = uuid;
        this.item_group = undefined;
    } 

    GetName() : string {
        return this.name_;
    }

    SetName(name: string) : void {
        this.name_ = name;
    }

    GetPath() : string {
        return this.path_;
    }

    SetPath(path: string) : void {
        this.path_ = path;
    } 

    Parse() : void {
        var content = fs.readFileSync(this.path_).toString();
        var xml_object = xml.parseString(content, (err, result) => {
            if (!result.hasOwnProperty("Project")) {
                return;
            }

            if (!result.Project.hasOwnProperty("ItemGroup")) {
                return;
            }

            if (!result.Project.hasOwnProperty("ItemDefinitionGroup")) {
                return;
            }

            this.item_group = new ItemGroup(this.path_, result.Project);

            result.Project.ItemDefinitionGroup.forEach((idg: any, index: any, self: any) => {
                var g = new ItemDefinitionGroup(this.path_, idg);
                this.item_definition_group.set(g.Condition, g);
            });
        });
    }

    GetFiles() : string[] {
        if (!this.item_group) {
            return [];
        }

        return this.item_group.GetSources().map((v, index, self) => {
            return v.GetFile();
        });
    }

    GetUUID(): string {
        return this.uuid_;
    }

    SetUUID(uuid: string) {
        this.uuid_ = uuid;
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
        var no_condition = this.item_definition_group.get("");
        var no_condition_values = no_condition ? no_condition.CompileConfig.PreprocessorDefinitions : [];
        if (!config || config === "") {
            return no_condition_values;
        }

        var condition= this.item_definition_group.get(config);
        var condition_values = condition ? condition.CompileConfig.PreprocessorDefinitions : [];

        return no_condition_values.concat(condition_values);
    }

    SetDefines(config: string | undefined, defines: string[]) {
        if (!config || config === "") {
            var no_condition = this.item_definition_group.get("");
            if (no_condition) {
                no_condition.CompileConfig.PreprocessorDefinitions = defines;
            }
        } else {
            var condition = this.item_definition_group.get(config);
            if (!condition) {
                throw new Error("No such configuration: " + config);
            }
            condition.CompileConfig.PreprocessorDefinitions = defines;
        }
    }


    GetIncludeDirs(config: string | undefined) : string[] {
        var no_condition = this.item_definition_group.get("");
        var no_condition_values = no_condition ? no_condition.CompileConfig.AdditionalIncludeDirectories : [];
        if (!config || config === "") {
            return no_condition_values;
        }

        var condition= this.item_definition_group.get(config);
        var condition_values = condition ? condition.CompileConfig.AdditionalIncludeDirectories : [];

        return no_condition_values.concat(condition_values);
    }

    SetIncludeDirs(config: string | undefined, includes: string[]) {
        if (!config || config === "") {
            var no_condition = this.item_definition_group.get("");
            if (no_condition) {
                no_condition.CompileConfig.AdditionalIncludeDirectories = includes;
            }
        } else {
            var condition = this.item_definition_group.get(config);
            if (!condition) {
                throw new Error("No such configuration: " + config);
            }
            condition.CompileConfig.AdditionalIncludeDirectories = includes;
        }
    }

    GetLibDirs(config: string | undefined) : string[] {
        throw new Error("Not implement");
    }

    SetLibDirs(config: string | undefined, dirs: string[]) {
        throw new Error("Not implement");
    }

    GetCompileFlags(config: string | undefined) : string[] {
        var no_condition = this.item_definition_group.get("");
        var no_condition_values = no_condition ? no_condition.CompileConfig.AdditionalOptions : [];
        if (!config || config === "") {
            return no_condition_values;
        }

        var condition= this.item_definition_group.get(config);
        var condition_values = condition ? condition.CompileConfig.AdditionalOptions : [];

        return no_condition_values.concat(condition_values);
    }

    SetCompileFlags(config: string | undefined, flags: string[]) {
        if (!config || config === "") {
            var no_condition = this.item_definition_group.get("");
            if (no_condition) {
                no_condition.CompileConfig.AdditionalOptions = flags;
            }
        } else {
            var condition = this.item_definition_group.get(config);
            if (!condition) {
                throw new Error("No such configuration: " + config);
            }
            condition.CompileConfig.AdditionalOptions = flags;
        }
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

