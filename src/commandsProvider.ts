import * as vscode from 'vscode';
import { execMageforge, getMagentoRoot } from './magento';

export interface MageforgeCommand {
    id: string;
    label: string;
    description: string;
    cliCommand: string;
    icon: string;
    /** Whether the command accepts theme codes as argument. */
    acceptsThemes?: boolean;
    /** Long-running watch command. */
    isWatch?: boolean;
}

export const MAGEFORGE_COMMANDS: MageforgeCommand[] = [
    {
        id: 'mageforge.theme.build',
        label: 'Theme: Build',
        description: 'mageforge:theme:build',
        cliCommand: 'mageforge:theme:build',
        icon: 'tools',
        acceptsThemes: true,
    },
    {
        id: 'mageforge.theme.watch',
        label: 'Theme: Watch',
        description: 'mageforge:theme:watch',
        cliCommand: 'mageforge:theme:watch',
        icon: 'eye',
        acceptsThemes: true,
        isWatch: true,
    },
    {
        id: 'mageforge.theme.clean',
        label: 'Theme: Clean',
        description: 'mageforge:theme:clean',
        cliCommand: 'mageforge:theme:clean',
        icon: 'trash',
    },
    {
        id: 'mageforge.theme.list',
        label: 'Theme: List',
        description: 'mageforge:theme:list',
        cliCommand: 'mageforge:theme:list',
        icon: 'list-unordered',
    },
    {
        id: 'mageforge.theme.inspector',
        label: 'Theme: Inspector',
        description: 'mageforge:theme:inspector',
        cliCommand: 'mageforge:theme:inspector',
        icon: 'search',
    },
    {
        id: 'mageforge.hyva.tokens',
        label: 'Hyvä: Tokens',
        description: 'mageforge:hyva:tokens',
        cliCommand: 'mageforge:hyva:tokens',
        icon: 'symbol-color',
    },
    {
        id: 'mageforge.hyva.compatibilityCheck',
        label: 'Hyvä: Compatibility Check',
        description: 'mageforge:hyva:compatibility:check',
        cliCommand: 'mageforge:hyva:compatibility:check',
        icon: 'checklist',
    },
    {
        id: 'mageforge.template.override',
        label: 'Template: Override',
        description: 'mageforge:template:override',
        cliCommand: 'mageforge:template:override',
        icon: 'copy',
    },
    {
        id: 'mageforge.dependencies.update',
        label: 'Dependencies: Update',
        description: 'mageforge:dependencies:update',
        cliCommand: 'mageforge:dependencies:update',
        icon: 'cloud-download',
    },
    {
        id: 'mageforge.system.check',
        label: 'System: Check',
        description: 'mageforge:system:check',
        cliCommand: 'mageforge:system:check',
        icon: 'pulse',
    },
    {
        id: 'mageforge.system.version',
        label: 'System: Version',
        description: 'mageforge:system:version',
        cliCommand: 'mageforge:system:version',
        icon: 'info',
    },
];

/**
 * Query the installed MageForge CLI for the commands it actually exposes.
 * Returns the raw command names (e.g. `mageforge:theme:build`).
 */
export async function getAvailableMageforgeCommands(magentoRoot: string): Promise<string[]> {
    const output = await execMageforge(magentoRoot, 'list', ['--raw', 'mageforge']);
    return output
        .split('\n')
        .map((line) => stripAnsi(line).trim())
        .filter((line) => line.length > 0)
        .map((line) => line.split(/\s+/)[0]);
}

export class CommandsProvider implements vscode.TreeDataProvider<CommandTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private availableCommands: Set<string> | undefined;
    private loadError: string | undefined;
    private loadingPromise: Promise<void> | undefined;

    refresh(): void {
        this.availableCommands = undefined;
        this.loadError = undefined;
        this.loadingPromise = undefined;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: CommandTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CommandTreeItem): Promise<CommandTreeItem[]> {
        if (element) {
            return [];
        }

        await this.ensureCommandsLoaded();

        if (this.loadError) {
            return [new CommandTreeItem(undefined, this.loadError)];
        }

        const commands = this.availableCommands
            ? MAGEFORGE_COMMANDS.filter((cmd) => this.availableCommands!.has(cmd.cliCommand))
            : MAGEFORGE_COMMANDS;

        return commands.map((cmd) => new CommandTreeItem(cmd));
    }

    private async ensureCommandsLoaded(): Promise<void> {
        if (this.availableCommands !== undefined || this.loadError !== undefined) {
            return;
        }

        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }

        this.loadingPromise = this.loadCommands().finally(() => {
            this.loadingPromise = undefined;
        });
        await this.loadingPromise;
    }

    private async loadCommands(): Promise<void> {
        const root = getMagentoRoot();
        if (!root) {
            this.loadError = 'Open a Magento workspace to see available commands.';
            return;
        }

        try {
            const available = await getAvailableMageforgeCommands(root);
            this.availableCommands = new Set(available);
            this.loadError = undefined;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.availableCommands = undefined;
            this.loadError = formatLoadError(stripAnsi(message));
        }
    }
}

export class CommandTreeItem extends vscode.TreeItem {
    constructor(
        public readonly mageforgeCommand: MageforgeCommand | undefined,
        label?: string,
    ) {
        super(label ?? mageforgeCommand!.label, vscode.TreeItemCollapsibleState.None);

        if (mageforgeCommand) {
            this.description = mageforgeCommand.description;
            this.tooltip = new vscode.MarkdownString(
                `**${mageforgeCommand.label}**\n\n\`${mageforgeCommand.description}\``,
            );
            this.iconPath = new vscode.ThemeIcon(mageforgeCommand.icon);
            this.command = {
                command: mageforgeCommand.id,
                title: mageforgeCommand.label,
            };
            this.contextValue = 'mageforgeCommand';
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}

/** Strip ANSI escape sequences (colors, cursor movement) from console output. */
function stripAnsi(text: string): string {
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/**
 * Convert a raw command failure into a user-friendly error message.
 * Long messages are truncated so they do not break the tree view layout.
 */
function formatLoadError(message: string): string {
    const normalized = message.toLowerCase();

    if (
        normalized.includes('ddev') &&
        /not (running|started)|could not|failed|unable/i.test(message)
    ) {
        return 'DDEV is not running. Start the project with `ddev start` and try again.';
    }
    if (normalized.includes('docker-compose') || normalized.includes('docker compose')) {
        return 'Docker Compose service unavailable. Check that containers are running.';
    }
    if (normalized.includes('lando')) {
        return 'Lando environment unavailable. Start the project with `lando start`.';
    }
    if (normalized.includes('command not found') || normalized.includes('no such file')) {
        return 'MageForge CLI not found. Run `composer require openforgeproject/mageforge`.';
    }

    return message.length > 120 ? `${message.slice(0, 120)}…` : message;
}
