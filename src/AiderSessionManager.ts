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
    private _isStarting = false;
    private _isContextDirty = false; // Add a dirty flag

    private constructor() {
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

        vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === this._terminal) {
                this.endSession();
            }
        });
        this.updateStatusBar();
    }

    private setContextDirty(isDirty: boolean) {
        if (this._isContextDirty === isDirty) return;
        this._isContextDirty = isDirty;
        vscode.commands.executeCommand('setContext', 'aider.contextIsDirty', isDirty);
        this.updateStatusBar();
    }

    // ... getInstance, setViewProvider, getContextFiles ... (no changes here)

    public static getInstance(): AiderSessionManager {
        if (!AiderSessionManager._instance) {
            AiderSessionManager._instance = new AiderSessionManager();
        }
        return AiderSessionManager._instance;
    }

    public setViewProvider(provider: AiderContextViewProvider) {
        this._viewProvider = provider;
    }

    public getContextFiles(): Map<string, { readOnly: boolean }> {
        return this._contextFiles;
    }

    private updateStatusBar() {
        const fileCount = this._contextFiles.size;
        if (!this._terminal) {
            this._statusBarItem.text = `$(terminal) Aider: Inactive`;
            this._statusBarItem.tooltip = 'Click to start an Aider session';
            this._statusBarItem.command = 'aider.start';
        } else {
            let text = `$(terminal-flame) Aider: ${fileCount} files`;
            if (this._isContextDirty) {
                text += ' (unsynced)'; // Indicate unsynced state
            }
            this._statusBarItem.text = text;
            this._statusBarItem.tooltip = 'Aider session is active. Click the Stop icon in the sidebar to end.';
            this._statusBarItem.command = 'workbench.action.terminal.focus';
        }
        this._statusBarItem.show();
    }

    // ... loadIgnoreRules, isIgnored ... (no changes here)

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
        if (relativePath === '') return false;
        return this._ignorer.ignores(relativePath);
    }

    public startSession() {
        if (this._terminal) {
            this._terminal.show();
            return;
        }

        vscode.commands.executeCommand('setContext', 'aider.sessionActive', true);

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

        this.registerSessionListeners();

        if (config.get<boolean>('autoAddOnOpen')) {
            const openFiles = vscode.workspace.textDocuments
                .filter(doc => !doc.isUntitled && doc.uri.scheme === 'file')
                .map(doc => doc.uri.fsPath);

            if (openFiles.length > 0) {
                this.addFiles(openFiles, { silent: true }); // Use a silent add
            }
        }
        this.syncContext(); // Perform an initial sync on start
        this.updateStatusBar();
    }

    // ... stopSession ... (no changes here)
    public stopSession() {
        if (this._terminal) {
            this._terminal.dispose();
        }
    }

    private registerSessionListeners() {
        const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (this._isStarting || !editor) return;

            const document = editor.document;
            if (document.isUntitled || document.uri.scheme !== 'file') return;

            const config = vscode.workspace.getConfiguration('aider');
            if (config.get<boolean>('autoAddOnOpen') && !this._contextFiles.has(document.uri.fsPath)) {
                // Just update the internal list and mark as dirty
                this._contextFiles.set(document.uri.fsPath, { readOnly: false });
                this.setContextDirty(true);
                this._viewProvider?.refresh();
            }
        });

        const onCloseFile = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
            if (document.isUntitled || document.uri.scheme !== 'file' || !this._contextFiles.has(document.uri.fsPath)) return;

            const config = vscode.workspace.getConfiguration('aider');
            if (config.get<boolean>('autoDropOnClose')) {
                // Just update the internal list and mark as dirty
                this._contextFiles.delete(document.uri.fsPath);
                this.setContextDirty(true);
                this._viewProvider?.refresh();
            }
        });

        this._sessionDisposables.push(onDidChangeActiveEditor, onCloseFile);
    }

    public syncContext() {
        if (!this._terminal) {
            vscode.window.showWarningMessage("Aider session not active.");
            return;
        }

        // 1. Clear the context in the Aider terminal.
        this._terminal.sendText('/drop *');

        const files = Array.from(this._contextFiles.keys());
        const readOnlyFiles = Array.from(this._contextFiles.entries())
            .filter(([, status]) => status.readOnly)
            .map(([path]) => path);
        const normalFiles = files.filter(f => !readOnlyFiles.includes(f));

        // 2. Add back the files from our virtual context.
        if (normalFiles.length > 0) {
            const quotedPaths = normalFiles.map(p => `"${p}"`).join(' ');
            this._terminal.sendText(`/add ${quotedPaths}`);
        }
        if (readOnlyFiles.length > 0) {
            const quotedPaths = readOnlyFiles.map(p => `"${p}"`).join(' ');
            this._terminal.sendText(`/read ${quotedPaths}`);
        }

        this.setContextDirty(false); // Mark context as clean
        vscode.window.setStatusBarMessage('Aider context synced.', 3000);
    }

    private endSession() {
        vscode.window.showInformationMessage('Aider session terminated.');
        this._terminal = undefined;
        this._contextFiles.clear();

        vscode.commands.executeCommand('setContext', 'aider.sessionActive', false);
        this.setContextDirty(false); // Reset dirty flag

        this._sessionDisposables.forEach(d => d.dispose());
        this._sessionDisposables = [];

        this.updateStatusBar();
        this._viewProvider?.refresh();
    }

    public addFiles(filePaths: string[], options?: { readOnly?: boolean; silent?: boolean }) {
        if (!this._terminal || filePaths.length === 0) return;

        const unignoredFilePaths = filePaths.filter(p => !this.isIgnored(p));
        if (unignoredFilePaths.length === 0) return;

        const readOnly = !!options?.readOnly;
        let changed = false;

        unignoredFilePaths.forEach(p => {
            if (!this._contextFiles.has(p) || this._contextFiles.get(p)?.readOnly !== readOnly) {
                this._contextFiles.set(p, { readOnly });
                changed = true;
            }
        });

        if (changed) {
            if (!options?.silent) {
                this.setContextDirty(true);
            }
            this._viewProvider?.refresh();
            this.updateStatusBar();
        }
    }

    public dropFile(filePath: string) {
        if (!this._terminal || !this._contextFiles.has(filePath)) return;

        if (this._contextFiles.delete(filePath)) {
            this.setContextDirty(true);
            this._viewProvider?.refresh();
            this.updateStatusBar();
        }
    }

    // ... listFiles ... (no change here)
    public listFiles() {
        if (!this._terminal) return;
        this._terminal.sendText('/ls');
        this._terminal.show();
    }

    public clearContext() {
        if (!this._terminal) return;

        if (this._contextFiles.size > 0) {
            this._contextFiles.clear();
            this.setContextDirty(true);
            this._viewProvider?.refresh();
            vscode.window.setStatusBarMessage(`All files staged to be dropped. Press Sync to apply.`, 4000);
        }
    }

    public sendCommand(command: string) {
        if (!this._terminal) {
            vscode.window.showWarningMessage("Aider session not active.");
            return;
        }
        this._terminal.sendText(command);
        this._terminal.show(); // Bring terminal to the front
    }

    public isSessionActive(): boolean {
        return !!this._terminal;
    }
}