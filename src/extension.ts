import * as vscode from 'vscode';
import { CommandsProvider, MAGEFORGE_COMMANDS, MageforgeCommand } from './commandsProvider';
import { ThemeTreeItem, ThemesProvider } from './themesProvider';
import { WelcomeViewProvider } from './welcomeProvider';
import { buildCommandLine, getMagentoRoot, runInTerminal } from './magento';

export function activate(context: vscode.ExtensionContext) {
    const commandsProvider = new CommandsProvider();
    const themesProvider = new ThemesProvider();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WelcomeViewProvider.viewType,
            new WelcomeViewProvider(context.extensionUri),
        ),
        vscode.window.registerTreeDataProvider('mageforge.commands', commandsProvider),
        vscode.window.registerTreeDataProvider('mageforge.themes', themesProvider),
    );

    // Register one VS Code command per MageForge CLI command.
    for (const cmd of MAGEFORGE_COMMANDS) {
        context.subscriptions.push(
            vscode.commands.registerCommand(cmd.id, async (item?: ThemeTreeItem) => {
                await runMageforgeCommand(cmd, themesProvider, item);
            }),
        );
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('mageforge.refreshThemes', () => themesProvider.refresh()),
    );
}

async function runMageforgeCommand(
    cmd: MageforgeCommand,
    themesProvider: ThemesProvider,
    item?: ThemeTreeItem,
): Promise<void> {
    const magentoRoot = getMagentoRoot();
    if (!magentoRoot) {
        void vscode.window.showErrorMessage('MageForge: No workspace folder open.');
        return;
    }

    const args: string[] = [];

    // Theme argument: from tree item context menu or via quick pick.
    if (cmd.acceptsThemes) {
        let themeCode = item?.theme?.code;

        if (!themeCode) {
            const themes = await themesProvider.getThemeCodes();
            if (themes.length > 0) {
                const picked = await vscode.window.showQuickPick(themes, {
                    placeHolder: 'Select a theme (or press Esc to run interactively)',
                    canPickMany: false,
                });
                themeCode = picked;
            }
        }

        if (themeCode) {
            args.push(themeCode);
        }
    }

    const commandLine = buildCommandLine(magentoRoot, cmd.cliCommand, args);
    const terminalName = cmd.isWatch ? `MageForge: ${cmd.label}` : `MageForge: ${cmd.cliCommand}`;
    runInTerminal(terminalName, commandLine, magentoRoot);
}

export function deactivate() {}
