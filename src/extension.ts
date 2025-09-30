// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';
import { AiderSessionManager } from './AiderSessionManager';
import { AiderContextViewProvider, ContextFileItem } from './AiderContextViewProvider';


interface AiderTask {
	label: string;
	description: string;
	command: string;
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Aider Smart Context is now active.');

	const sessionManager = AiderSessionManager.getInstance();

	let startCommand = vscode.commands.registerCommand('aider.start', () => {
		sessionManager.startSession();
	});

	const aiderContextViewProvider = new AiderContextViewProvider();
	sessionManager.setViewProvider(aiderContextViewProvider);

	vscode.window.registerTreeDataProvider(
		'aider-context-view',
		aiderContextViewProvider
	);

	// const onOpenFile = vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
	// 	if (document.isUntitled || document.uri.scheme !== 'file') {
	// 		return;
	// 	}

	// 	// Confirm the document is actually visible to the user.
	// 	// This prevents adding files that VS Code or other extensions open in the background.
	// 	const isDocumentVisible = vscode.window.visibleTextEditors.some(
	// 		(editor) => editor.document.uri.toString() === document.uri.toString()
	// 	);

	// 	if (!isDocumentVisible) {
	// 		return; // This is a background event, so we ignore it.
	// 	}

	// 	const config = vscode.workspace.getConfiguration('aider');
	// 	if (config.get<boolean>('autoAddOnOpen')) {
	// 		sessionManager.addFile(document.uri.fsPath);
	// 	}
	// });

	// const onCloseFile = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
	// 	if (document.isUntitled || document.uri.scheme !== 'file') {
	// 		return;
	// 	}
	// 	const config = vscode.workspace.getConfiguration('aider');
	// 	if (config.get<boolean>('autoDropOnClose')) {
	// 		sessionManager.dropFile(document.uri.fsPath);
	// 	}
	// });

	let listFilesCommand = vscode.commands.registerCommand('aider.listFiles', () => {
		sessionManager.listFiles();
	});

	let dropAllFilesCommand = vscode.commands.registerCommand('aider.dropAllFiles', () => {
		sessionManager.clearContext();
	});

	let dropFileCommand = vscode.commands.registerCommand('aider.dropFileFromContext', (item: ContextFileItem) => {
		if (item && item.filePath) {
			const sessionManager = AiderSessionManager.getInstance();
			sessionManager.dropFile(item.filePath);
		}
	});

	let addFromDirCommand = vscode.commands.registerCommand('aider.addAllFromDirectory', async () => {
		const uris = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			title: 'Select a directory to add to Aider'
		});

		if (!uris || uris.length === 0) {
			return; // User cancelled the dialog
		}

		const directoryUri = uris[0];
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(directoryUri);

		// --- ROBUSTNESS CHECK ---
		// If the selected directory is not part of an open workspace, we cannot reliably
		// find a .gitignore file or establish a relative path. We must stop and inform the user.
		if (!workspaceFolder) {
			vscode.window.showErrorMessage(
				'The selected folder is not part of the current workspace. Please open the folder or its parent in VS Code to proceed.'
			);
			return;
		}

		// --- .gitignore logic ---
		// This code now safely assumes 'workspaceFolder' is defined.
		const ig = ignore();
		try {
			const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');
			const gitignoreContent = await vscode.workspace.fs.readFile(gitignoreUri);
			ig.add(Buffer.from(gitignoreContent).toString('utf8'));
		} catch (e) {
			console.log("No .gitignore found in workspace root or failed to read it.");
		}

		// --- Recursive file walking logic (no changes here) ---
		const filesToAdd: string[] = [];

		async function walk(dir: vscode.Uri, wsFolder: vscode.WorkspaceFolder) {
			const entries = await vscode.workspace.fs.readDirectory(dir);
			for (const [name, type] of entries) {
				const currentUri = vscode.Uri.joinPath(dir, name);
				// MODIFIED: Uses the passed-in 'wsFolder' parameter.
				const relativePath = path.posix.relative(wsFolder.uri.path, currentUri.path);

				if (ig.ignores(relativePath)) {
					continue;
				}

				if (type === vscode.FileType.File) {
					filesToAdd.push(currentUri.fsPath);
				} else if (type === vscode.FileType.Directory) {
					await walk(currentUri, wsFolder); // Pass it along in the recursive call.
				}
			}
		}

		await walk(directoryUri, workspaceFolder);

		const sessionManager = AiderSessionManager.getInstance();
		sessionManager.addFiles(filesToAdd);

		vscode.window.showInformationMessage(`Added ${filesToAdd.length} files to the Aider context.`);
	});

	let addActiveReadOnly = vscode.commands.registerCommand('aider.addActiveFileAsReadOnly', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			sessionManager.addFiles([editor.document.uri.fsPath], { readOnly: true });
		}
	});

	let addExplorerReadOnly = vscode.commands.registerCommand('aider.addFileAsReadOnlyFromExplorer', (uri: vscode.Uri, uris: vscode.Uri[]) => {
		const urisToProcess = uris || [uri];
		const filePaths = urisToProcess.map(u => u.fsPath).filter(p => p);
		if (filePaths.length > 0) {
			sessionManager.addFiles(filePaths, { readOnly: true });
		}
	});

	let addExplorerFile = vscode.commands.registerCommand('aider.addFileFromExplorer', (uri: vscode.Uri, uris: vscode.Uri[]) => {
		const urisToProcess = uris || [uri]; // Use the array if it exists, otherwise use the single URI
		const filePaths = urisToProcess.map(u => u.fsPath).filter(p => p);
		if (filePaths.length > 0) {
			sessionManager.addFiles(filePaths, { readOnly: false });
		}
	});

	let stopCommand = vscode.commands.registerCommand('aider.stop', () => {
		sessionManager.stopSession();
	});

	let syncContextCommand = vscode.commands.registerCommand('aider.syncContext', () => {
		sessionManager.syncContext();
	});

	let runCustomTaskCommand = vscode.commands.registerCommand('aider.runCustomTask', async () => {
		const sessionManager = AiderSessionManager.getInstance();
		if (!sessionManager.isSessionActive()) {
			vscode.window.showWarningMessage('Aider session is not active. Please start a session first.');
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder is open.');
			return;
		}

		const tasksUri = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'aider-tasks.json');

		try {
			const fileContent = await vscode.workspace.fs.readFile(tasksUri);
			const tasks = JSON.parse(Buffer.from(fileContent).toString('utf8')) as AiderTask[];

			if (!Array.isArray(tasks) || tasks.length === 0) {
				vscode.window.showErrorMessage('No tasks found or `aider-tasks.json` is not a valid array.');
				return;
			}

			const selectedTask = await vscode.window.showQuickPick(tasks, {
				placeHolder: 'Select a custom Aider task to run',
				title: 'Aider Custom Tasks'
			});

			if (selectedTask) {
				sessionManager.sendCommand(selectedTask.command);
			}

		} catch (error) {
			// Handle file not found specifically
			if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
				const createOption = 'Create aider-tasks.json';
				vscode.window.showInformationMessage(
					'No `.vscode/aider-tasks.json` file found in this workspace.',
					createOption
				).then(selection => {
					if (selection === createOption) {
						const exampleContent = '[\n  {\n    "label": "🧪 My First Task",\n    "description": "A description for my task.",\n    "command": "This is the prompt to send to aider."\n  }\n]';
						fs.writeFileSync(tasksUri.fsPath, exampleContent);
						vscode.workspace.openTextDocument(tasksUri).then(doc => vscode.window.showTextDocument(doc));
					}
				});
			} else {
				vscode.window.showErrorMessage(`Error reading or parsing aider-tasks.json: ${error}`);
			}
		}
	});

	context.subscriptions.push(startCommand, stopCommand, listFilesCommand, dropFileCommand, dropAllFilesCommand, addFromDirCommand, addActiveReadOnly, addExplorerReadOnly, addExplorerFile, syncContextCommand, runCustomTaskCommand);
}



// This method is called when your extension is deactivated
export function deactivate() { }
