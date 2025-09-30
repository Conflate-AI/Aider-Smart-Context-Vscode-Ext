// src/AiderSessionManager.ts
import * as vscode from 'vscode';
import { AiderContextViewProvider } from './AiderContextViewProvider';

export class AiderSessionManager {
    private static _instance: AiderSessionManager;
    private _terminal: vscode.Terminal | undefined;
    private _contextFiles: Map<string, { readOnly: boolean }> = new Map();
    private _statusBarItem: vscode.StatusBarItem;
    private _viewProvider: AiderContextViewProvider | undefined;

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

    public startSession() {
        if (this._terminal) {
            this._terminal.show();
            return;
        }

        const config = vscode.workspace.getConfiguration('aider');
        const executablePath = config.get<string>('executablePath', 'aider');
        this._terminal = vscode.window.createTerminal(`Aider`);
        this._terminal.sendText('aider');
        this._terminal.show();
        this.updateStatusBar();

        // Listen for the terminal being closed by the user
        vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === this._terminal) {
                vscode.window.showInformationMessage('Aider session terminated.');
                this._terminal = undefined;
                this._contextFiles.clear();
                this.updateStatusBar();
            }
        });
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

        const readOnly = !!options?.readOnly;
        const newFiles = filePaths.filter(p => !this._contextFiles.has(p));

        if (newFiles.length === 0) return;

        const quotedPaths = newFiles.map(p => `"${p}"`).join(' ');
        const command = readOnly ? `/read ${quotedPaths}` : `/add ${quotedPaths}`;

        this._terminal.sendText(command);

        newFiles.forEach(p => this._contextFiles.set(p, { readOnly: readOnly }));

        if (this._viewProvider) {
            this._viewProvider.refresh();
        }
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