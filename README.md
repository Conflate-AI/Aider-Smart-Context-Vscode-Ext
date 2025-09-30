# Aider Smart Context for VS Code

**Seamlessly manage your `aider` chat context and automate repetitive prompts directly within VS Code.**

Stop manually typing `/add`, `/drop`, and the same instructions over and over. This extension turns `aider` into a fully integrated part of your VS Code workflow, letting you focus on coding with your AI pair programmer, not managing its context or re-typing commands.

-----

## Features

✨ **Smart Context Staging**: Files are automatically *staged* when you open or close them. A dedicated **Sync** button pushes all context changes to `aider` at once, preventing your prompts from being interrupted.

🧠 **Dedicated Context View**: A new Aider icon in the Activity Bar opens a dedicated view showing you exactly which files are staged in the context at all times.

🚀 **Custom Task Runner**: Define your own frequently used `aider` commands in a project-specific file and run them instantly from a quick-pick menu. Perfect for tasks like running tests, refactoring, or adding documentation.

🗑️ **Inline Actions**: Instantly remove a file from the context by clicking the `(x)` icon next to it in the Aider Context View.

📂 **Explorer Integration**: Right-click on any file or folder in the VS Code Explorer to stage it for the context.

  * **Add to Context**: Stages the selected file(s).
  * **Add as Read-Only**: Stages the selected file(s) and tells `aider` not to edit them.
  * **Add Directory**: Recursively stages all files in a directory, intelligently respecting your `.gitignore` rules.

⚙️ **Session Management**: Start and stop your `aider` session from the Command Palette or the sidebar, all within a dedicated, integrated VS Code terminal.

-----

## Requirements

You must have the `aider-chat` command-line tool installed and available in your system's PATH.

[Aider Installation Instructions](https://aider.chat/docs/install.html).

-----

## Usage

1.  Click the new **Aider icon** in your Activity Bar, or run the **`Aider: Start Session`** command from the Command Palette (`Ctrl+Shift+P`).
2.  An integrated terminal will open and start an `aider` session.
3.  As you open and close files, they will be automatically staged. The status bar and Sync icon will update to show you have pending changes.
4.  Click the **Sync icon** `$(sync-ignored)` in the Aider sidebar to send the staged files to the `aider` terminal.
5.  Use the **Aider Context View** in the sidebar to monitor and manage the context manually.

### Running Custom Tasks

You can automate repetitive prompts by creating a tasks file in your project.

1.  Create a file named `.vscode/aider-tasks.json` in your workspace.
2.  Define your tasks in this file. Each task needs a `label`, `description`, and the `command` (prompt) to send to `aider`.
    ```json
    // .vscode/aider-tasks.json
    [
      {
        "label": "🧪 Run Tests & Fix",
        "description": "Runs 'npm test' and asks Aider to fix any resulting failures.",
        "command": "/run npm test"
      },
      {
        "label": "📚 Add Docstrings",
        "description": "Asks Aider to add comprehensive docstrings to the current context.",
        "command": "Add comprehensive JSDoc-style docstrings to all functions and classes in the current context."
      }
    ]
    ```
3.  Click the **beaker icon** `$(beaker)` in the Aider sidebar or run the `Aider: Run Custom Task...` command from the Command Palette to open a list of your tasks. Selecting one will instantly send the command to the `aider` terminal.

-----

### Commands

  * `Aider: Start Session` - Starts the main `aider` session.
  * `Aider: Stop Session` - Stops the current session.
  * `Aider: Sync Context` - Pushes all staged file changes to `aider`.
  * `Aider: Run Custom Task...` - Opens a menu of your user-defined tasks.
  * `Aider: Add All Files in Directory...` - Opens a dialog to select a directory to add.
  * `Aider: Add Active File as Read-Only` - Adds the currently focused file as read-only.
  * `Aider: Drop All Files` - Clears all files from the `aider` context.

-----

## Extension Settings

This extension contributes the following settings to your `settings.json`:

  * `aider.executablePath`: The absolute path to the `aider` executable (defaults to `"aider"`).
  * `aider.autoAddOnOpen`: (`true`/`false`) Automatically stage files for the context when they are opened.
  * `aider.autoDropOnClose`: (`true`/`false`) Automatically stage files for removal from the context when they are closed.

**Important**: To end a session, always use the **Stop icon** in the Aider sidebar or run the `Aider: Stop Session` command. Do not type `/exit` in the terminal, as this will leave the extension in an inconsistent state.

-----

## Known Issues
  * Multi-root workspaces are not yet fully supported. The extension will bind to the first workspace folder.

Note this was an attempt to solve my own problem and make my usage of Aider more efficient, but I am happy to look at any issues or feature requests anyone has. Please report any other issues on the [GitHub Issues page](https://github.com/Conflate-AI/Aider-Smart-Context-Vscode-Ext/issues).

-----

**Enjoy a more productive AI coding experience\!**