import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as absprovider from "./project_view_provider";
import * as view from "../View/item";
import * as model from "../model/project";
import * as event from "./view_provider_events";


function GetBuildTerminal(): vscode.Terminal {
    let terminal : any = undefined;
    vscode.window.terminals.forEach(t => {
         if(t.name === "build") {
              terminal =  t;
        } 
    });
    if (!terminal) {
        terminal = vscode.window.createTerminal("build");
    }
    return terminal;
}

var g_output_channel_ : any = undefined
function GetFindResultPanel() : vscode.OutputChannel {
    if (!g_output_channel_) {
        g_output_channel_ = vscode.window.createOutputChannel("Cpp Solution Explorer");
    }
    return g_output_channel_;
}

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
        if (item.GetItemType() !== view.ItemType.FILE) {
            return;
        }
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
        if (item.GetItemType() === view.ItemType.PROJECT) {
            // build project
            var project_model = item.GetModel() as model.Project;
            var cmd = project_model.GetBuildTask().command;
            const terminal = GetBuildTerminal();
            terminal.show();
            terminal.sendText(cmd, true);
        } else {
            return;
        }
    }
}

class RebuildProjectCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider)
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {
        if (item.GetItemType() === view.ItemType.PROJECT) {
            // build project
            var project_model = item.GetModel() as model.Project;
            const terminal = GetBuildTerminal();
            terminal.show();
            terminal.sendText(project_model.GetCleanTask().command, true);
            terminal.sendText(project_model.GetBuildTask().command, true);
        } else {
            return;
        }
    }
}

class CleanProjectCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider);
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {
        if (item.GetItemType() === view.ItemType.PROJECT) {
            // clean project
            var project_model = item.GetModel() as model.Project;
            var cmd = project_model.GetCleanTask().command;
            const terminal = GetBuildTerminal();
            terminal.show();
            terminal.sendText(cmd, true);
        } else {
            return;
        }
    }
}

class FindFileCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider);
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {

        if (item.GetItemType() === view.ItemType.TOP_LEVEL) {
            // get file name from user
            let options: vscode.InputBoxOptions = {
                prompt: "Label: ",
                placeHolder: ""
            };
            
            var file_name = ""
            await vscode.window.showInputBox(options).then(value => {
                if (!value) { return; }
                file_name = value;
            });

            if (file_name === "") { return; }

            var panel = GetFindResultPanel();
            panel.show();
            panel.clear();
            var projects = item.GetChildren();
            var total_count = 0;
            var file_count = 0;
            await projects.forEach((project, index, self) => {
                var project_model = project.GetModel() as model.Project;
                project_model.GetFiles().forEach((file, index, self) => {
                    if (process.platform === "win32") {
                        file = "/" + file;
                    }
                    if (file.indexOf(file_name) !== -1) {
                        panel.appendLine("file://" + file);
                        file_count++;
                    }
                    total_count++;
                });
            });
            panel.appendLine("Found " + file_count.toString() + " records in " + total_count.toString() + " files");
        } else {
            return;
        }
    }
}

class FindInSolutionCommand extends AbsCommand{
    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider);
    }

    async Run(item_: view.ProjectViewItem) : Promise<void> {
        if (!vscode.window.activeTextEditor) { return; }
        if (vscode.window.activeTextEditor.selections.length > 1) { return; }
        var file_path = vscode.window.activeTextEditor.document.fileName;
        var search_value = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.selection);
        if (search_value === "") { return; }
        var v = event.GetFileFromCache(file_path);
        if (!v) { return; }
        var item = v;
        var p = v.GetParent();
        if (p) {
            var pp = p.GetParent();
            if (pp) {
                var ppp = pp.GetParent();
                if (ppp) {
                    item = ppp;
                }
            }
        }
        
        if (item.GetItemType() === view.ItemType.TOP_LEVEL) {
            // get text from user
            let options: vscode.InputBoxOptions = {
                prompt: "Label: ",
                placeHolder: ""
            };
            
            var panel = GetFindResultPanel();
            panel.show();
            panel.clear();
            var projects = item.GetChildren();
            var record_count = 0;
            var file_count = 0;
            await projects.forEach((project, index, self) => {
                var project_model = project.GetModel() as model.Project;
                project_model.GetFiles().forEach((file, index, self) => {
                    var txt : string= fs.readFileSync(file).toString();
                    var lines = txt.split("\n");
                    var found = false
                    if (process.platform === "win32") {
                        file = "/" + file;
                    }
                    lines.forEach((line, index, self) => {
                        if (line.indexOf(search_value) !== -1) {
                            panel.appendLine("file://" + file + " (" + index + "): " + line);
                            found = true;
                            record_count++;
                        }
                    });
                    if (found) {
                        file_count++;
                    }
                });
            });
            panel.appendLine("Found " + record_count.toString() + " records in " + file_count.toString() + " files");
        } else {
            return;
        }
    }
}

class ChangeConfigCommand extends AbsCommand{
    static in_use_project_ : string = "";

    constructor(provider: absprovider.TreeViewProviderProjects) {
        super(provider)
    }

    async Run(item: view.ProjectViewItem) : Promise<void> {
        if (!vscode.window.activeTextEditor) { return; }
        var file_path = vscode.window.activeTextEditor.document.fileName;
        var v = event.GetFileFromCache(file_path);
        if (!v) { return; }
        if (v.GetItemType() !== view.ItemType.FILE) { return; }
        var group = v.GetParent();
        if (!group) return
        var project = group.GetParent();
        if (!project) return;

        var project_model = project.GetModel() as model.Project;
        if (ChangeConfigCommand.in_use_project_ === project_model.GetFullName()) { return; }
        ChangeConfigCommand.in_use_project_ = project_model.GetFullName()
        var c_cpp = project_model.GetPropertyConfig()
        var json_root = vscode.workspace.rootPath ? vscode.workspace.rootPath : "./";
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
        this.commands_.set("OpenFile", new OpenFileCommand(provider));
        this.commands_.set("BuildProject", new BuildProjectCommand(provider));
        this.commands_.set("RebuildProject", new RebuildProjectCommand(provider));
        this.commands_.set("CleanProject", new CleanProjectCommand(provider));
        this.commands_.set("ChangeConfig", new ChangeConfigCommand(provider));
        this.commands_.set("FindFile", new FindFileCommand(provider));
        this.commands_.set("FindInSolution", new FindInSolutionCommand(provider));

    }

    public Register() : void {
        this.commands_.forEach((value, key, self) => {
            vscode.commands.registerCommand("CppSolutionExplorer." + key, item => {
                value.Run(item)
            })
        });
    }
}