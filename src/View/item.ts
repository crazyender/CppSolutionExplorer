import * as vscode from "vscode";
import * as path from "path";
import * as model from "../Model/project";
import * as event from "../Provider/view_provider_events";

export enum ItemType {
    TOP_LEVEL,
    CONFIG_GROUP,
    CONFIG,
    PROJECT,
    FILE_GROUP,
    FILE
}

export abstract class ProjectViewItem extends vscode.TreeItem {

    private item_type_ : ItemType;
    private name_ : string;
    constructor(name: string = "", t: ItemType = ItemType.FILE, parent: ProjectViewItem | undefined) {
        super(name, (t === ItemType.FILE || t === ItemType.CONFIG) ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
        this.name_ = name;
        this.item_type_ = t;
    }

    abstract GetChildren() : ProjectViewItem[];

    abstract GetParent() : ProjectViewItem | undefined;


    abstract GetModel() : model.AbsModel;


    GetItemType() {
        return this.item_type_;
    }


}

class FileLevelView extends ProjectViewItem {

    private file_ : model.File;
    private parent_ : ProjectViewItem;

    constructor(file: model.File, parent: ProjectViewItem) {
        super(file.GetName(), ItemType.FILE, parent);
        this.file_ = file;
        this.parent_ = parent;
        this.tooltip = file.GetFullName();
        this.label = file.GetName();
        var proj_view = this.parent_.GetParent();
        var proj_model = undefined;
        if (proj_view) {
            proj_model = proj_view.GetModel() as model.Project;
            this.id = proj_view.GetModel().GetFullName() + ":" + file.GetFullName();
        } else {
            this.id = file.GetFullName();
        }
        var file_properties = "r";
        if (proj_model) {
            if (!proj_model.IsReadOnly()) {
                file_properties += "w";
            } else {
                file_properties += "n";
            }
        } else {
            file_properties += "n";
        }
        this.contextValue = "file_" + file_properties;
        this.command = {
            command: 'CppSolutionExplorer.OpenFile',
            arguments: [this],
            title: 'Open File'
        };
    
        var ext = path.extname(file.GetName());
        var icon_name = "";
        switch(ext) {
            case ".c":
                icon_name = "c.svg";
                break;
            case ".cc":
                icon_name = "cc.svg";
                break;
            case ".cpp":
            case ".cxx":
                icon_name = "cpp.svg";
                break;
            case ".h":
                icon_name = "h.svg";
                break;
            case ".hh":
            case ".hpp":
            case ".hxx":
                icon_name = "hpp.svg";
                break;
            case ".java":
                icon_name = "java.svg";
                break;
            case ".m":
            case ".mm":
            default:
                icon_name = "file.svg";
                break;
        }
        this.iconPath = path.join(__filename, "..", "..", "..", "icons", icon_name);
        var full_name = file.GetFullName().split("\\").join("/").trim();
        event.AddFileCache(full_name, this);
    }

    GetChildren() : ProjectViewItem[] {
        return [];
    }

    GetParent() : ProjectViewItem | undefined{
        return this.parent_;
    }

    GetModel() {
        return this.file_;
    }
}

class FileGroupLevelView extends ProjectViewItem {
    private group_ : model.FileGroup;
    private children_: ProjectViewItem[];
    private parent_ : ProjectViewItem;

    constructor(group: model.FileGroup, parent: ProjectViewItem) {
        super(group.GetName(), ItemType.FILE_GROUP, parent);
        this.group_ = group;
        this.parent_ = parent;
        var files = group.GetFiles();
        this.label = group.GetName();
        this.id = parent.GetModel().GetFullName() + "_" + group.GetName();
        this.contextValue = "filegroup";
        this.children_ = [];
        for(var i = 0; i < files.length; i++) {
            this.children_.push(new FileLevelView(files[i], this));
        }
        this.iconPath = path.join(__filename, "..", "..", "..", "icons", "folder.svg");
    }

    GetChildren() : ProjectViewItem[] {
        return this.children_;
    }

    GetParent() : ProjectViewItem | undefined{
        return this.parent_;
    }

    GetModel() {
        return this.group_;
    }
}

class ProjectLevelView extends ProjectViewItem {
    private project_ : model.Project;
    private children_: ProjectViewItem[];
    private parent_ : ProjectViewItem;

    constructor(project: model.Project, parent: ProjectViewItem) {
        super(project.GetName(), ItemType.PROJECT, parent);
        this.project_ = project;
        this.parent_ = parent;
        var groups = project.GetGroups();
        this.tooltip = project.GetFullName();

        this.id = project.GetFullName();
        var project_properties = "r";
        if (!project.IsReadOnly()) {
            project_properties += "w";
        } else {
            project_properties += "n";
        }
        if (project.CanBuild()) {
            project_properties += "b";
        } else {
            project_properties += "n";
        }

        this.label = project.GetName();
        this.contextValue = "project_" + project_properties;

        this.children_ = [];
        for(var i = 0; i < groups.length; i++) {
            this.children_.push(new FileGroupLevelView(groups[i], this));
        }
        this.iconPath = path.join(__filename, "..", "..", "..", "icons", "vcxproj.svg");
    }

    GetChildren() : ProjectViewItem[] {
        return this.children_;
    }

    GetParent() : ProjectViewItem | undefined{
        return this.parent_;
    }

    GetModel() {
        return this.project_;
    }
}

class ConfigLevelView extends ProjectViewItem {
    private parent_ : ProjectViewItem;
    private model_: model.Null;
    constructor (name: string, config: string, parent: ProjectViewItem) {
        super("Configuration", ItemType.CONFIG, parent);
        this.parent_ = parent;
        this.contextValue = "config";
        this.model_ = new model.Null();
        this.iconPath = path.join(__filename, "..", "..", "..", "icons", "file.svg");
        this.id = name + ":configs:" + config;
        this.tooltip = config;
        this.label = config;
        this.command = {
            command: 'CppSolutionExplorer.SelectConfig',
            arguments: [this],
            title: 'Select Configuration'
        };
    }

    GetChildren() : ProjectViewItem[] {
        return [];
    }

    GetParent() : ProjectViewItem | undefined{
        return this.parent_;
    }

    GetModel() {
        return this.model_;
    }
}

class ConfigGroupLevelView extends ProjectViewItem {
    private parent_ : ProjectViewItem;
    private configs_ : string[];
    private children_: ProjectViewItem[] = [];
    private model_: model.Null;
    constructor (name: string, configs: string[], parent: ProjectViewItem) {
    super("Configurations", ItemType.CONFIG_GROUP, parent);
        this.configs_ = configs;
        this.parent_ = parent;
        this.contextValue = "configs";
        configs.forEach((c, i, self) => {
            this.children_.push(new ConfigLevelView(name, c, this));
        });
        this.model_ = new model.Null();
        this.iconPath = path.join(__filename, "..", "..", "..", "icons", "packages.svg");
        this.id = name + ":configs";
        this.tooltip = "Configurations";
        this.label = "Configurations";
    }

    GetChildren() : ProjectViewItem[] {
        return this.children_;
    }

    GetParent() : ProjectViewItem | undefined{
        return this.parent_;
    }

    GetModel() {
        return this.model_;
    }
}

class TopLevelView extends ProjectViewItem {
    private children_: ProjectViewItem[];
    private empty_model_: model.Null;

    constructor(name: string, projects: model.Project[], configs: string[]) {
        super(name, ItemType.TOP_LEVEL, undefined);
        this.empty_model_ = new model.Null();
        this.children_ = [];
        this.children_.push(new ConfigGroupLevelView(name, configs, this));
        for(var i = 0; i < projects.length; i++) {
            this.children_.push(new ProjectLevelView(projects[i], this));
        }

        this.iconPath = path.join(__filename, "..", "..", "..", "icons", "sln.svg");
        this.contextValue = "toplevel";
    }

    GetChildren() : ProjectViewItem[] {
        return this.children_;
    }

    GetParent() : ProjectViewItem | undefined{
        return undefined;
    }

    GetModel() {
        return this.empty_model_;
    }
}

export function CreateTopLevel(name: string, children: model.Project[], configs: string[]) : ProjectViewItem {
    return new TopLevelView(name, children, configs);
}