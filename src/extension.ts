// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { PanelProvider } from "./PanelProvider";
import { SideCarClient } from "./sidecar/client";
import { startSidecarBinary } from "./utilities/setupSidecarBinary";

export let SIDECAR_CLIENT: SideCarClient | null = null;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const sidecarUrl = await startSidecarBinary(context.globalStorageUri.fsPath); // vscode.env.appRoot second argument
  console.log("sidecarUrl", sidecarUrl);

  const sidecarClient = new SideCarClient(sidecarUrl);

  const healthCheck = await sidecarClient.healthCheck();
  console.log('Sidecar health check', healthCheck);

  const panelProvider = new PanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("sota-pr-panel", panelProvider)
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const command = vscode.commands.registerCommand(
    "extension.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from extension!");
    }
  );

  context.subscriptions.push(command);
}

// This method is called when your extension is deactivated
export function deactivate() { }
