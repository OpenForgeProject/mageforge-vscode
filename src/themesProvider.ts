import * as vscode from 'vscode';
import { execMageforge, getMagentoRoot } from './magento';

export interface MagentoTheme {
    code: string;
    title?: string;
    area?: string;
}

export class ThemesProvider implements vscode.TreeDataProvider<ThemeTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<ThemeTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private themes: MagentoTheme[] | undefined;
    private loadError: string | undefined;
    private loadingPromise: Promise<void> | undefined;
    private loadGeneration = 0;

    refresh(): void {
        this.themes = undefined;
        this.loadError = undefined;
        this.loadingPromise = undefined;
        this.loadGeneration++;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ThemeTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ThemeTreeItem): Promise<ThemeTreeItem[]> {
        if (element) {
            return [];
        }

        await this.ensureThemesLoaded();

        if (this.loadError) {
            return [new ThemeTreeItem(undefined, this.loadError)];
        }

        return (this.themes ?? []).map((theme) => new ThemeTreeItem(theme));
    }

    /** Cached list of theme codes for quick-picks. */
    async getThemeCodes(): Promise<string[]> {
        await this.ensureThemesLoaded();
        return (this.themes ?? []).map((t) => t.code);
    }

    private async ensureThemesLoaded(): Promise<void> {
        if (this.themes !== undefined) {
            return;
        }

        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }

        const generation = this.loadGeneration;
        this.loadingPromise = this.loadThemes(generation).finally(() => {
            // Only clear the promise if no newer refresh has started.
            if (this.loadingPromise && this.loadGeneration === generation) {
                this.loadingPromise = undefined;
            }
        });
        await this.loadingPromise;
    }

    private async loadThemes(generation: number): Promise<void> {
        const root = getMagentoRoot();
        if (!root) {
            if (generation !== this.loadGeneration) {
                return;
            }
            this.themes = [];
            this.loadError = 'No workspace folder open';
            return;
        }

        try {
            const output = await execMageforge(root, 'mageforge:theme:list');
            if (generation !== this.loadGeneration) {
                return;
            }
            this.themes = parseThemeList(output);
            this.loadError = undefined;
        } catch (error) {
            if (generation !== this.loadGeneration) {
                return;
            }
            this.themes = [];
            const message = error instanceof Error ? error.message : String(error);
            const cleaned = stripAnsi(message);
            this.loadError = formatLoadError(cleaned);
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

/**
 * Parse `mageforge:theme:list` output. The command renders a Symfony console
 * table with the columns Code | Title | Path – we extract the theme codes
 * (Vendor/theme) together with their titles.
 */
export function parseThemeList(output: string): MagentoTheme[] {
    const themes = new Map<string, MagentoTheme>();

    for (const rawLine of stripAnsi(output).split('\n')) {
        // Table rows look like: │ Magento/luma  │ Luma  │ vendor/magento/theme-frontend-luma │
        // Split on box-drawing or ASCII column separators.
        const cells = rawLine
            .split(/[│|]/)
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0);

        const codeIndex = cells.findIndex((cell) =>
            /^[A-Z][A-Za-z0-9_]*\/[A-Za-z0-9_-]+$/.test(cell),
        );
        if (codeIndex === -1) {
            continue;
        }

        const code = cells[codeIndex];
        // The title is the cell right after the code, unless it looks like a filesystem path.
        const candidate = cells[codeIndex + 1];
        const title =
            candidate && !candidate.includes('/') && candidate !== code ? candidate : undefined;
        // The path column looks like "frontend/Magento/blank" or "adminhtml/Magento/backend".
        const pathCell = cells.find((cell) => /^(frontend|adminhtml)\//.test(cell));
        const area = pathCell?.startsWith('adminhtml/') ? 'adminhtml' : 'frontend';

        if (!themes.has(code)) {
            themes.set(code, { code, title, area });
        }
    }

    return [...themes.values()];
}

export class ThemeTreeItem extends vscode.TreeItem {
    constructor(
        public readonly theme: MagentoTheme | undefined,
        errorMessage?: string,
    ) {
        super(theme ? theme.code : 'Could not load themes', vscode.TreeItemCollapsibleState.None);

        if (theme) {
            this.description = theme.title;
            this.tooltip = new vscode.MarkdownString(
                `**${theme.code}**${theme.title ? `\n\n${theme.title}` : ''}${theme.area ? `\n\nArea: ${theme.area}` : ''}`,
            );
            this.iconPath = new vscode.ThemeIcon(
                theme.area === 'adminhtml' ? 'shield' : 'paintcan',
                theme.area === 'adminhtml'
                    ? new vscode.ThemeColor('charts.yellow')
                    : new vscode.ThemeColor('charts.blue'),
            );
            this.contextValue = 'mageforgeTheme';
        } else {
            this.description = errorMessage;
            this.tooltip = errorMessage;
            this.iconPath = new vscode.ThemeIcon('warning');
            this.contextValue = 'mageforgeThemeError';
        }
    }
}
