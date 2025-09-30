// src/AiderSessionManager.ts
import * as vscode from 'vscode';
import * as path from 'path';
import ignore from 'ignore';
import { AiderContextViewProvider } from './AiderContextViewProvider';

export class AiderSessionManager {
    private static _instance: AiderSessionManager;
    private _terminal: vscode.Terminal | undefined;
    private _contextFiles: Map<string, { readOnly: boolean }> = new Map();
    private _statusBarItem: vscode.StatusBarItem;
    private _viewProvider: AiderContextViewProvider | undefined;
    private _sessionDisposables: vscode.Disposable[] = [];
    private _ignorer = ignore();
    private _workspaceFolder: vscode.WorkspaceFolder | undefined;

    private constructor() {
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.updateStatusBar();
    }

    public setViewProvider(provider: AiderContextViewProvider) {
        this._viewProvider = provider;
    }

    public getContextFiles(): Map<string, { readOnly: boolean }> {
        return this._contextFiles;
    }

    public static getInstance(): AiderSessionManager {
        if (!AiderSessionManager._instance) {
            AiderSessionManager._instance = new AiderSessionManager();
        }
        return AiderSessionManager._instance;
    }

    private updateStatusBar() {
        const fileCount = this._contextFiles.size;
        if (!this._terminal) {
            this._statusBarItem.text = `$(terminal) Aider: Inactive`;
            this._statusBarItem.tooltip = 'Click to start an Aider session';
            this._statusBarItem.command = 'aider.start'; // Make it clickable!
        } else {
            this._statusBarItem.text = `$(terminal-flame) Aider: ${fileCount} files`;
            this._statusBarItem.tooltip = 'Aider session is active. Click to view terminal.';
            this._statusBarItem.command = 'workbench.action.terminal.focus';
        }
        this._statusBarItem.show();
    }

    private async loadIgnoreRules() {
        if (!this._workspaceFolder) return;

        this._ignorer = ignore(); // Reset the ignorer
        try {
            const gitignoreUri = vscode.Uri.joinPath(this._workspaceFolder.uri, '.gitignore');
            const gitignoreContent = await vscode.workspace.fs.readFile(gitignoreUri);
            this._ignorer.add(Buffer.from(gitignoreContent).toString('utf8'));
        } catch (e) {
            console.log("Aider: No .gitignore found in workspace root or failed to read it.");
        }
    }

    private isIgnored(filePath: string): boolean {
        if (!this._workspaceFolder) return false;

        const relativePath = path.relative(this._workspaceFolder.uri.fsPath, filePath);
        // An empty relative path means it's the root folder itself, which can't be ignored.
        if (relativePath === '') return false;

        return this._ignorer.ignores(relativePath);
    }

    public startSession() {
        if (this._terminal) {
            this._terminal.show();
            return;
        }

        this._workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
        if (!this._workspaceFolder) {
            vscode.window.showErrorMessage("Aider Smart Context requires an open folder to function correctly.");
            return;
        }
        this.loadIgnoreRules();

        const config = vscode.workspace.getConfiguration('aider');
        const executablePath = config.get<string>('executablePath', 'aider');
        this._terminal = vscode.window.createTerminal(`Aider`);
        this._terminal.sendText(executablePath);
        this._terminal.show();
        this.updateStatusBar();

        this.registerSessionListeners();

        // Listen for the terminal being closed by the user
        vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === this._terminal) {
                this.endSession(); // Call a dedicated cleanup method
            }
        });

        if (config.get<boolean>('autoAddOnOpen')) {
            const openFiles = vscode.workspace.textDocuments
                .filter(doc => !doc.isUntitled && doc.uri.scheme === 'file')
                .map(doc => doc.uri.fsPath);

            if (openFiles.length > 0) {
                this.addFiles(openFiles);
            }
        }
    }

    private registerSessionListeners() {
        // Listener for opening files
        const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
            // This event fires with `undefined` when you focus away from an editor
            if (editor) {
                const document = editor.document;
                if (document.isUntitled || document.uri.scheme !== 'file' || !this._terminal) return;

                // Now that we're using a more direct event, we don't need the complex 'isDocumentVisible' check.
                const config = vscode.workspace.getConfiguration('aider');
                if (config.get<boolean>('autoAddOnOpen')) {
                    this.addFile(document.uri.fsPath);
                }
            }
        });

        // Listener for closing files
        const onCloseFile = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
            if (document.isUntitled || document.uri.scheme !== 'file' || !this._terminal) return;
            const config = vscode.workspace.getConfiguration('aider');
            if (config.get<boolean>('autoDropOnClose')) {
                this.dropFile(document.uri.fsPath);
            }
        });

        this._sessionDisposables.push(onDidChangeActiveEditor, onCloseFile);
    }

    private endSession() {
        vscode.window.showInformationMessage('Aider session terminated.');
        this._terminal = undefined;
        this._contextFiles.clear();

        // --- NEW: Dispose of listeners to prevent memory leaks ---
        this._sessionDisposables.forEach(d => d.dispose());
        this._sessionDisposables = [];

        this.updateStatusBar();
        if (this._viewProvider) {
            this._viewProvider.refresh();
        }
    }

    public addFile(filePath: string) {
        if (!this._terminal || this._contextFiles.has(filePath)) {
            return; // Don't add if session isn't running or file is already there
        }
        this.addFiles([filePath]);
    }

    /**
 * Adds multiple files to the Aider context in a single command.
 */
    public addFiles(filePaths: string[], options?: { readOnly?: boolean }) {
        if (!this._terminal || filePaths.length === 0) {
            return;
        }

        const unignoredFilePaths = filePaths.filter(p => !this.isIgnored(p));

        if (unignoredFilePaths.length === 0) {
            // If all files were ignored, let the user know.
            if (filePaths.length > 0) {
                console.log(`Aider: All ${filePaths.length} file(s) are ignored by .gitignore.`);
            }
            return;
        }

        const readOnly = !!options?.readOnly;
        const newFiles = unignoredFilePaths.filter(p => !this._contextFiles.has(p));

        if (newFiles.length === 0) return;

        const quotedPaths = newFiles.map(p => `"${p}"`).join(' ');
        const command = readOnly ? `/read ${quotedPaths}` : `/add ${quotedPaths}`;

        this._terminal.sendText(command);

        newFiles.forEach(p => this._contextFiles.set(p, { readOnly: readOnly }));

        if (this._viewProvider) {
            this._viewProvider.refresh();
        }
        this.updateStatusBar();
    }

    public dropFile(filePath: string) {
        if (!this._terminal || !this._contextFiles.has(filePath)) {
            return;
        }
        this._terminal.sendText(`/drop "${filePath}"`);
        this._contextFiles.delete(filePath); // Use .delete() for Map

        if (this._viewProvider) {
            this._viewProvider.refresh();
        }
        this.updateStatusBar();
    }

    public listFiles() {
        if (!this._terminal) return;
        this._terminal.sendText('/ls');
        this._terminal.show(); // Bring terminal to front
    }

    public clearContext() {
        if (!this._terminal) return;
        this._terminal.sendText('/clear');
        this._terminal.sendText('/drop *');
        this._contextFiles.clear();
        if (this._viewProvider) {
            this._viewProvider.refresh(); // Refresh the view!
        }
        vscode.window.showInformationMessage('Aider context and history cleared.');
        vscode.window.setStatusBarMessage(`Aider context and history cleared.`, 3000);
        this.updateStatusBar();
    }
}