import * as vscode from "vscode";
import * as model from "../Model/project";

export enum ItemType {
    TOP_LEVEL,
    PROJECT,
    FILE_GROUP,
    FILE
}

export abstract class ProjectViewItem extends vscode.TreeItem {

    private item_type_ : ItemType;
    private name_ : string;
    constructor(name: string = "", t: ItemType = ItemType.FILE, parent: ProjectViewItem | undefined) {
        super(name, t === ItemType.FILE ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
        this.name_ = name;
        this.item_type_ = t;
    }

    abstract GetChildren() : ProjectViewItem[];

    abstract GetParent() : ProjectViewItem | undefined;
}

class FileLevelView extends ProjectViewItem {
}

class FileGroupLevelView extends ProjectViewItem {
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
        this.children_ = [];
        for(var i = 0; i < groups.length; i++) {
            this.children_.push(new FileGroupLevelView(groups[i], this));
        }
    }

    GetChildren() : ProjectViewItem[] {
        return this.children_;
    }

    GetParent() : ProjectViewItem | undefined{
        return this.parent_;
    }
}

class TopLevelView extends ProjectViewItem {
    private children_: ProjectViewItem[];

    constructor(name: string, projects: model.Project[]) {
        super(name, ItemType.TOP_LEVEL, undefined);
        this.children_ = [];
        for(var i = 0; i < projects.length; i++) {
            this.children_.push(new ProjectLevelView(projects[i], this))
        }
    }

    GetChildren() : ProjectViewItem[] {
        return this.children_;
    }

    GetParent() : ProjectViewItem | undefined{
        return undefined;
    }
}

export function CreateTopLevel(children: model.Project[]) : ProjectViewItem {
    return new TopLevelView("", children);
}