import * as vscode from 'vscode';

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

export class CommandsProvider implements vscode.TreeDataProvider<CommandTreeItem> {
    getTreeItem(element: CommandTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): CommandTreeItem[] {
        return MAGEFORGE_COMMANDS.map((cmd) => new CommandTreeItem(cmd));
    }
}

export class CommandTreeItem extends vscode.TreeItem {
    constructor(public readonly mageforgeCommand: MageforgeCommand) {
        super(mageforgeCommand.label, vscode.TreeItemCollapsibleState.None);
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
    }
}
