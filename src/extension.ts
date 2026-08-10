import * as vscode from 'vscode';
import { CommandsProvider, MAGEFORGE_COMMANDS, MageforgeCommand } from './commandsProvider';
import { ThemeTreeItem, ThemesProvider } from './themesProvider';
import { WelcomeViewProvider } from './welcomeProvider';
import { ChangelogViewProvider } from './changelogProvider';
import { buildCommandLine, getMagentoRoot, runInTerminal } from './magento';

export function activate(context: vscode.ExtensionContext) {
    const commandsProvider = new CommandsProvider();
    const themesProvider = new ThemesProvider();
    const changelogProvider = new ChangelogViewProvider(context.extensionUri);

    // Show menu entries immediately - the extension handles missing Magento gracefully.
    void vscode.commands.executeCommand('setContext', 'mageforge.active', true);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WelcomeViewProvider.viewType,
            new WelcomeViewProvider(context.extensionUri),
        ),
        vscode.window.registerTreeDataProvider('mageforge.commands', commandsProvider),
        vscode.window.registerTreeDataProvider('mageforge.themes', themesProvider),
    );

    // Notify the user and open the changelog after the extension was updated.
    void showUpdateNotificationIfNeeded(context, changelogProvider);

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
        vscode.commands.registerCommand(
            'mageforge.template.overrideFile',
            async (uri?: vscode.Uri) => {
                await overrideFile(uri, themesProvider);
            },
        ),
        vscode.commands.registerCommand('mageforge.showChangelog', () => {
            changelogProvider.show(context.extension.packageJSON.version);
        }),
    );
}

/**
 * Shows an update notification and opens the changelog tab when the extension
 * version has changed since the last activation.
 */
async function showUpdateNotificationIfNeeded(
    context: vscode.ExtensionContext,
    changelogProvider: ChangelogViewProvider,
): Promise<void> {
    const currentVersion = context.extension.packageJSON.version as string;
    const lastVersion = context.globalState.get<string>('mageforge.lastSeenVersion');

    if (lastVersion && lastVersion !== currentVersion) {
        changelogProvider.show(`v${currentVersion}`);
        const selection = await vscode.window.showInformationMessage(
            `MageForge has been updated to v${currentVersion}.`,
            'Open Changelog',
            'Dismiss',
        );
        if (selection === 'Open Changelog') {
            changelogProvider.show(`v${currentVersion}`);
        }
    }

    await context.globalState.update('mageforge.lastSeenVersion', currentVersion);
}

/**
 * Explorer context menu: override the selected template file in a chosen theme.
 * Runs: bin/magento mageforge:template:override <file> --theme <Vendor/theme>
 */
async function overrideFile(
    uri: vscode.Uri | undefined,
    themesProvider: ThemesProvider,
): Promise<void> {
    if (!uri) {
        uri = vscode.window.activeTextEditor?.document.uri;
    }
    if (!uri) {
        void vscode.window.showErrorMessage('MageForge: No file selected.');
        return;
    }

    const magentoRoot = getMagentoRoot();
    if (!magentoRoot) {
        void vscode.window.showErrorMessage('MageForge: No workspace folder open.');
        return;
    }

    // Pick the target theme (frontend themes only make sense for overrides).
    const themes = await themesProvider.getThemeCodes();
    const theme = await vscode.window.showQuickPick(themes, {
        placeHolder: 'Override into which theme?',
        title: `MageForge: Override ${uri.path.split('/').pop()}`,
    });
    if (!theme) {
        return;
    }

    const commandLine = buildCommandLine(magentoRoot, 'mageforge:template:override', [
        `'${uri.fsPath}'`,
        '--theme',
        theme,
    ]);
    runInTerminal('MageForge: template:override', commandLine, magentoRoot);
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

