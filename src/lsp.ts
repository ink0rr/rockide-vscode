import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import { getProjectPaths } from "./project";

let current: LanguageClient | null;

export async function startClient(exe: vscode.Uri) {
	if (current) {
		throw new Error("Another client is already running!");
	}

	const serverOptions: ServerOptions = {
		command: exe.fsPath,
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: "file", language: "json" },
			{ scheme: "file", language: "jsonc" },
			{ scheme: "file", language: "rockide-lang" },
		],
		uriConverters: {
			code2Protocol: (uri) => uri.toString(true),
			protocol2Code: (path) => vscode.Uri.parse(path),
		},
		initializationOptions: getProjectPaths(),
	};
	const client = new LanguageClient("rockide", "Rockide", serverOptions, clientOptions);
	current = client;

	await client.start();
}

export async function stopClient() {
	if (!current) {
		return;
	}
	const client = current;
	current = null;
	// The `stop` call will send the "shutdown" notification to the LSP
	await client.stop();
	// The `dipose` call will send the "exit" request to the LSP which actually tells the child process to exit
	await client.dispose();
}
