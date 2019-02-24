import * as vscode from "vscode";
import * as path from "path"
import * as fs from "fs"
import * as absprovider from "./project_view_provider"
import * as view from "../View/item"
import * as model from "../model/project"
import * as event from "./view_provider_events"

abstract class AbsCommand {
    private provider_ : absprovider.TreeViewProviderProjects
    constructor(provider: absprovider.TreeViewProviderProjects) {
        this.provider_ = provider
    }

    public abstract async Run(item: view.ProjectViewItem) : Promise<void>;
}

class OpenFileCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider)
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {
        if (item.GetItemType() != view.ItemType.FILE)
            return;
        var full_path = item.GetModel().GetFullName();
        let options: vscode.TextDocumentShowOptions = {
            preview:  false,
            preserveFocus: true
        };
        let document = await vscode.workspace.openTextDocument(full_path);
        vscode.window.showTextDocument(document, options); 
    }
}

class BuildProjectCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider)
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {

    }
}

class CleanProjectCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider)
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {

    }
}

class ChangeConfigCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider)
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {
        if (!vscode.window.activeTextEditor) return
        var file_path = vscode.window.activeTextEditor.document.fileName
        var v = event.TreeViewProviderProjectsEvents.all_opened_doc.get(file_path)
        if (!v) return
        if (v.GetItemType() != view.ItemType.FILE) return
        var group = v.GetParent()
        if (!group) return
        var project = group.GetParent()
        if (!project) return

        var project_model = project.GetModel() as model.Project
        var c_cpp = project_model.GetPropertyConfig()
        var json_root = vscode.workspace.rootPath ? vscode.workspace.rootPath : "./"
        var json_root = path.join(json_root, ".vscode")
        if (!fs.existsSync(json_root)) {
            fs.mkdirSync(json_root)
        }
        var c_pp_property = path.join(json_root, "c_cpp_properties.json")
        if (fs.existsSync(c_pp_property)) {
            fs.unlinkSync(c_pp_property)
        }
        fs.writeFile(c_pp_property, JSON.stringify(c_cpp, undefined, "  "), (err) => {
            
        })
    }
}

export class TreeViewProviderProjectsCommands {
    private commands_ : Map<string, AbsCommand> = new Map<string, AbsCommand>();

    constructor(provider: absprovider.TreeViewProviderProjects) {
        this.commands_.set("OpenFile", new OpenFileCommand(provider))
        this.commands_.set("BuildProject", new BuildProjectCommand(provider))
        this.commands_.set("CleanProject", new CleanProjectCommand(provider))
        this.commands_.set("ChangeConfig", new ChangeConfigCommand(provider))

    }

    public Register() : void {
        this.commands_.forEach((value, key, self) => {
            vscode.commands.registerCommand("CppSolutionExplorer." + key, item => {
                value.Run(item)
            })
        });
    }
}