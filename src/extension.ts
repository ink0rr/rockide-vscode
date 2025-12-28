import * as vscode from "vscode";
import { startClient, stopClient } from "./lsp";
import {
	getDefaultRockidePath,
	getInstalledRockideExe,
	promptInstallRockide,
	updateRockide,
} from "./rockide";

export async function activate(ctx: vscode.ExtensionContext) {
	ctx.subscriptions.push(
		vscode.commands.registerCommand("rockide.update", async () => {
			try {
				await updateRockide(ctx);
			} catch (err) {
				if (err instanceof Error) {
					vscode.window.showErrorMessage(err.message);
				}
			}
		}),
		vscode.workspace.onDidChangeConfiguration(async (event) => {
			if (event.affectsConfiguration("rockide.path")) {
				const res = await vscode.window.showInformationMessage(
					"Rockide path changed. Restart VSCode to apply your changes.",
					"Restart",
				);
				if (res === "Restart") {
					await vscode.commands.executeCommand("workbench.action.reloadWindow");
				}
			}
		}),
	);

	let rockideExe = await getInstalledRockideExe(ctx);
	if (!rockideExe) {
		try {
			rockideExe = getDefaultRockidePath(ctx);
			await promptInstallRockide(rockideExe);
		} catch (err) {
			if (err instanceof Error) {
				vscode.window.showErrorMessage(err.message);
			}
			return;
		}
	}

	ctx.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (event) => {
			if (event.affectsConfiguration("rockide.projectPaths")) {
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: "Project configuration changed. Restarting language server...",
				}, async () => {
					await stopClient();
					await startClient(rockideExe);
				});
			}
		}),
	);

	await startClient(rockideExe);
	await updateRockide(ctx, true);
}

export async function deactivate() {
	await stopClient();
}
