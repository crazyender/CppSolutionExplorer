import * as vscode from "vscode";
import * as path from "path";
import * as item from "../View/item";
import * as model from "../Model/project";
import * as gn from "../Provider/gn/tree_view_provider";
import * as vs from "../Provider/vs/tree_view_provider";
import * as Null from "../Provider/null/tree_view_provider";

/**
* GetProvider
*  Get tree view based on special files under root folder
* 
* @param:   None
* @return:  None
*/
export function CreateTreeView() {
    var root_path = vscode.workspace.rootPath;
    var provider = null;
}


export abstract class TreeViewProviderProjects implements vscode.TreeDataProvider<item.ProjectViewItem> {

    private top_level_item_: item.ProjectViewItem;

    constructor(f: string) {
        this.top_level_item_ = item.CreateTopLevel(this.GetProjects(f))
    }

    protected abstract  GetProjects(root_file: string) : model.Project[];

    getTreeItem(element: item.ProjectViewItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return this.top_level_item_;
    }

    getChildren(element?: item.ProjectViewItem | undefined): vscode.ProviderResult<item.ProjectViewItem[]> {
        if (!element) return [];
        return element ? element.GetChildren() : [];
    }

    getParent?(element: item.ProjectViewItem | undefined): vscode.ProviderResult<item.ProjectViewItem> {
        if(!element) return undefined;
        return element.GetParent();
    }

}