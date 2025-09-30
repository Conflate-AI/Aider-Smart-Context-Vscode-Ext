// src/AiderContextViewProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { AiderSessionManager } from './AiderSessionManager';

export class ContextFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
    ) {
        // We pass the URI to the parent class to get the default file icon and label behavior.
        super(vscode.Uri.file(filePath), vscode.TreeItemCollapsibleState.None);
        this.tooltip = this.filePath; // Show full path on hover
    }
}

export class AiderContextViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    // This event emitter is crucial for telling VS Code when to refresh the view
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        // Since we have a flat list, we only care about the root level (when element is undefined)
        if (element) {
            return Promise.resolve([]);
        }

        const sessionManager = AiderSessionManager.getInstance();
        const filesMap = sessionManager.getContextFiles();

        if (filesMap.size === 0) {
            return Promise.resolve([new vscode.TreeItem("No files in context.", vscode.TreeItemCollapsibleState.None)]);
        }

        const fileItems = Array.from(filesMap.entries()).map(([filePath, status]) => {
            const fileName = path.basename(filePath);
            const treeItem = new ContextFileItem(fileName, filePath);

            if (status.readOnly) {
                treeItem.description = "(read-only)";
                // Optional: change the icon for extra visual feedback
                treeItem.iconPath = new vscode.ThemeIcon('lock');
            }

            treeItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(filePath), { preview: false }],
            };
            return treeItem;
        });

        return Promise.resolve(fileItems);
    }
}