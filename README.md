# Aider Smart Context for VS Code

**Seamlessly manage your `aider` chat context directly within VS Code, with intelligent automation and a dedicated UI.**

Stop manually typing `/add` and `/drop`. This extension turns `aider` into a fully integrated part of your VS Code workflow, letting you focus on coding with your AI pair programmer, not managing its context.


## Features

✨ **Automatic Context Management**: Files are automatically added to the `aider` chat when you open them and removed when you close them. (Configurable)

🧠 **Dedicated Context View**: A new Aider icon in the Activity Bar opens a dedicated view showing you exactly which files are in the context at all times.

🗑️ **Inline Actions**: Instantly remove a file from the context by clicking the `(x)` icon next to it in the Aider Context View.

📂 **Explorer Integration**: Right-click on any file or folder in the VS Code Explorer to add it to the context.

  * **Add to Context**: Adds the selected file(s).
  * **Add as Read-Only**: Adds the selected file(s) and tells `aider` not to edit them.
  * **Add Directory**: Recursively adds all files in a directory, intelligently respecting your `.gitignore` rules.

⚙️ **Session Management**: Start and stop your `aider` session from the Command Palette, all within a dedicated, integrated VS Code terminal.

-----

## Requirements

You must have the `aider-chat` command-line tool installed and available in your system's PATH.

You can install it via pip:

```bash
pip install aider-chat
```

-----

## Usage

1.  Click the new **Aider icon** in your Activity Bar, or run the **`Aider: Start Session`** command from the Command Palette (`Ctrl+Shift+P`).
2.  An integrated terminal will open and start an `aider` session.
3.  As you open and close files, they will be automatically added or dropped from the context.
4.  Use the **Aider Context View** in the sidebar to monitor and manage the context manually.
5.  Right-click files in the **File Explorer** for more granular control.

### Commands

  * `Aider: Start Session` - Starts the main `aider` session.
  * `Aider: Add All Files in Directory...` - Opens a dialog to select a directory to add.
  * `Aider: Add Active File as Read-Only` - Adds the currently focused file as read-only.
  * `Aider: Drop All Files` - Clears the `aider` context.

-----

## Extension Settings

This extension contributes the following settings to your `settings.json`:

  * `aider.executablePath`: The absolute path to the `aider` executable (defaults to `"aider"`).
  * `aider.autoAddOnOpen`: (`true`/`false`) Automatically add files to the context when they are opened.
  * `aider.autoDropOnClose`: (`true`/`false`) Automatically drop files from the context when they are closed.

  **Important**: To end a session, always use the **Stop icon** in the Aider sidebar or run the `Aider: Stop Session` command. Do not type `/exit` in the terminal, as this will leave the extension in an inconsistent state.

-----

## Known Issues

  * Multi-root workspaces are not yet fully supported. The extension will bind to the first workspace folder.

Please report any other issues on the [GitHub Issues page](https://github.com/Conflate-AI/Aider-Smart-Context-Vscode-Ext/issues).


-----

**Enjoy a more productive AI coding experience\!**