import * as vscode from 'vscode';
import { getMagentoRoot, getExecutionEnvironment } from './magento';
import { isAllowedExternalUrl } from './url';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface QuickAction {
    label: string;
    command?: string;
    url?: string;
    icon: string;
}

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
    { label: 'Build Theme', command: 'mageforge.theme.build', icon: 'hammer' },
    { label: 'Watch Theme', command: 'mageforge.theme.watch', icon: 'eye' },
    { label: 'Inspector', command: 'mageforge.theme.inspector', icon: 'search' },
    { label: 'Hyvä Check', command: 'mageforge.hyva.compatibilityCheck', icon: 'checklist' },
    {
        label: 'Feature Request',
        url: 'https://github.com/OpenForgeProject/mageforge-vscode/issues/new?template=feature_request.md',
        icon: 'bulb',
    },
    {
        label: 'Rate',
        url: 'https://marketplace.visualstudio.com/items?itemName=OpenForgeProject.mageforge&ssr=false#review-details',
        icon: 'star',
    },
];

/**
 * Load the user-configured quick actions. Falls back to the default set when
 * the configuration is empty or invalid.
 */
function getQuickActions(): QuickAction[] {
    const config = vscode.workspace
        .getConfiguration('mageforge')
        .get<QuickAction[]>('quickActions');

    if (!Array.isArray(config) || config.length === 0) {
        return DEFAULT_QUICK_ACTIONS;
    }

    return config.filter((action) => isValidQuickAction(action));
}

/**
 * Validate a quick action from user settings.
 * - Requires a label and an icon.
 * - Requires either a command or a URL, but not both.
 * - Commands must belong to the mageforge namespace.
 * - URLs must use a safe https scheme.
 */
function isValidQuickAction(action: unknown): action is QuickAction {
    if (!action || typeof action !== 'object') {
        return false;
    }

    const { label, icon, command, url } = action as Partial<QuickAction>;

    if (typeof label !== 'string' || label.trim().length === 0) {
        return false;
    }
    if (typeof icon !== 'string' || icon.trim().length === 0) {
        return false;
    }

    const hasCommand = typeof command === 'string' && command.trim().length > 0;
    const hasUrl = typeof url === 'string' && url.trim().length > 0;

    if (!hasCommand && !hasUrl) {
        return false;
    }
    if (hasCommand && hasUrl) {
        return false;
    }
    if (hasCommand && !command!.startsWith('mageforge.')) {
        return false;
    }
    if (hasUrl && !isAllowedExternalUrl(url!)) {
        return false;
    }

    return true;
}

const DOCS_URL = 'https://github.com/OpenForgeProject/mageforge/blob/main/docs/';
const CHANGELOG_URL = 'https://github.com/OpenForgeProject/mageforge-vscode/blob/main/CHANGELOG.md';
const MAGEFORGE_ISSUES_URL = 'https://github.com/OpenForgeProject/mageforge/issues';
const EXTENSION_ISSUES_URL = 'https://github.com/OpenForgeProject/mageforge-vscode/issues';
const WEBSITE_URL = 'https://github.com/OpenForgeProject/mageforge';

/**
 * Webview-based welcome view shown at the top of the MageForge sidebar.
 * Displays the MageForge header logo, project status, quick actions and links.
 */
export class WelcomeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'mageforge.welcome';

    constructor(private readonly extensionUri: vscode.Uri) {}

    async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets')],
        };

        webviewView.webview.onDidReceiveMessage(
            (message: {
                command?: string;
                url?: string;
                type?: string;
                index?: number;
                fromIndex?: number;
                toIndex?: number;
            }) => {
                if (message.url && isAllowedExternalUrl(message.url)) {
                    void vscode.env.openExternal(vscode.Uri.parse(message.url));
                } else if (message.command) {
                    void vscode.commands.executeCommand(message.command);
                } else if (message.type === 'webviewReady') {
                    void this.sendVersionInfo(webviewView.webview);
                } else if (message.type === 'addQuickAction') {
                    void vscode.commands.executeCommand('mageforge.addQuickAction');
                } else if (
                    message.type === 'removeQuickAction' &&
                    typeof message.index === 'number'
                ) {
                    void vscode.commands.executeCommand(
                        'mageforge.removeQuickAction',
                        message.index,
                    );
                } else if (message.type === 'settingsQuickActions') {
                    void vscode.commands.executeCommand('mageforge.settingsQuickActions');
                } else if (
                    message.type === 'reorderQuickAction' &&
                    typeof message.fromIndex === 'number' &&
                    typeof message.toIndex === 'number'
                ) {
                    void vscode.commands.executeCommand(
                        'mageforge.reorderQuickAction',
                        message.fromIndex,
                        message.toIndex,
                    );
                }
            },
        );

        webviewView.webview.html = this.getHtml(webviewView.webview);

        // Re-fetch version info when the view becomes visible again, so the
        // badge never stays stuck in the loading state after the webview was
        // hidden (e.g. user switched to another sidebar section or left VS Code).
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                void this.sendVersionInfo(webviewView.webview);
            }
        });

        // Re-render the welcome view when quick action settings change so the
        // user sees the new buttons without reloading the window.
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('mageforge.quickActions')) {
                webviewView.webview.html = this.getHtml(webviewView.webview);
            }
        });
    }

    private async sendVersionInfo(webview: vscode.Webview): Promise<void> {
        const magentoRoot = getMagentoRoot();
        if (!magentoRoot) {
            return;
        }

        let installedVersion: string | undefined;
        let isDev = false;
        let latestVersion: string | undefined;
        let outdated = false;

        try {
            installedVersion = await this.withTimeout(this.getMageforgeVersion(magentoRoot), 2000);
            isDev = installedVersion?.startsWith('dev-') ?? false;
            latestVersion = isDev
                ? undefined
                : await this.withTimeout(this.getLatestMageforgeVersion(), 5000);
            outdated =
                !isDev && installedVersion && latestVersion
                    ? this.isOutdated(installedVersion, latestVersion)
                    : false;
        } catch {
            // Ignore failures from individual version checks; the UI is updated below.
        }

        void webview.postMessage({
            type: 'versionInfo',
            mageforge: installedVersion,
            latest: latestVersion,
            outdated,
            isDev,
        });
    }

    /**
     * Race a promise against a timeout. Resolves with `undefined` when the
     * timeout expires or the promise rejects, so the caller can always fall
     * back to a degraded UI state instead of hanging forever.
     */
    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(undefined), ms);
            promise
                .then((value) => {
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch(() => {
                    clearTimeout(timer);
                    resolve(undefined);
                });
        });
    }

    private async getMageforgeVersion(magentoRoot: string): Promise<string | undefined> {
        // Read the installed package version from composer metadata - more reliable
        // than spawning `composer show`, which may not be on the extension host PATH.
        const installedJson = path.join(magentoRoot, 'vendor', 'composer', 'installed.json');
        try {
            const raw = await fs.promises.readFile(installedJson, 'utf8');
            const data = JSON.parse(raw) as {
                packages?: { name: string; version: string }[];
            };
            const pkg = data.packages?.find((p) => p.name === 'openforgeproject/mageforge');
            return pkg?.version;
        } catch {
            return undefined;
        }
    }

    private async getLatestMageforgeVersion(): Promise<string | undefined> {
        const apiVersion = await this.getLatestMageforgeVersionFromApi();
        if (apiVersion) {
            return apiVersion;
        }
        // Fall back to the release redirect page when the API rate limit is exceeded.
        return this.getLatestMageforgeVersionFromRedirect();
    }

    private async getLatestMageforgeVersionFromApi(): Promise<string | undefined> {
        return new Promise((resolve) => {
            execFile(
                'curl',
                [
                    '-s',
                    '-A',
                    'mageforge-vscode',
                    '--max-time',
                    '3',
                    'https://api.github.com/repos/OpenForgeProject/mageforge/releases/latest',
                ],
                (error, stdout) => {
                    if (error) {
                        resolve(undefined);
                        return;
                    }
                    try {
                        const data = JSON.parse(stdout) as { tag_name?: string };
                        resolve(data.tag_name?.replace(/^v/, ''));
                    } catch {
                        resolve(undefined);
                    }
                },
            );
        });
    }

    private async getLatestMageforgeVersionFromRedirect(): Promise<string | undefined> {
        return new Promise((resolve) => {
            execFile(
                'curl',
                [
                    '-sI',
                    '-A',
                    'mageforge-vscode',
                    '--max-time',
                    '3',
                    'https://github.com/OpenForgeProject/mageforge/releases/latest',
                ],
                (error, stdout) => {
                    if (error) {
                        resolve(undefined);
                        return;
                    }
                    const match = stdout.match(/location:\s*.*\/tag\/v?([^\s/]+)/i);
                    resolve(match?.[1]);
                },
            );
        });
    }

    private isOutdated(installed: string, latest: string): boolean {
        const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
        const [iMajor, iMinor, iPatch] = parse(installed);
        const [lMajor, lMinor, lPatch] = parse(latest);
        if (lMajor !== iMajor) {
            return lMajor > iMajor;
        }
        if (lMinor !== iMinor) {
            return lMinor > iMinor;
        }
        return lPatch > iPatch;
    }

    private getEnvironmentBadge(env: string): string {
        switch (env) {
            case 'ddev':
                return '<span class="badge badge-ddev">DDEV</span>';
            case 'docker-compose':
                return '<span class="badge badge-docker">Docker</span>';
            case 'lando':
                return '<span class="badge badge-lando">Lando</span>';
            default:
                return '<span class="badge">Local PHP</span>';
        }
    }

    private getHtml(webview: vscode.Webview): string {
        const sloganLightUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.extensionUri,
                'resources',
                'assets',
                'MageForge-Slogan-dark.svg',
            ),
        );
        const sloganDarkUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets', 'MageForge-Slogan.svg'),
        );
        const nonce = getNonce();

        const magentoRoot = getMagentoRoot();
        const env = magentoRoot ? getExecutionEnvironment(magentoRoot) : 'local';
        const envBadge = this.getEnvironmentBadge(env);

        const actionButtons = getQuickActions()
            .map(
                (action, index) => `
            <button class="action" draggable="true" ${action.command ? `data-command="${action.command}"` : ''} ${action.url ? `data-url="${action.url}"` : ''} title="${action.label}" data-index="${index}">
                ${magentoRoot ? `<span class="action-remove" data-remove-index="${index}" title="Remove quick action"><i class="ti ti-x"></i></span>` : ''}
                <i class="ti ti-${action.icon}"></i>
                <span>${action.label}</span>
            </button>`,
            )
            .join('');

        const manageButtons = magentoRoot
            ? `<button class="action action-add" id="btn-add-quick-action" title="Add quick action" draggable="false">
                <i class="ti ti-plus"></i>
                <span>Add</span>
            </button>
            <button class="action action-edit" id="btn-edit-quick-actions" title="Quick actions settings" draggable="false">
                <i class="ti ti-settings"></i>
                <span>Settings</span>
            </button>`
            : '';

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src ${webview.cspSource} https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
    <style>
        :root {
            --gap: 16px;
            --radius: 6px;
            --accent: #f26322;
            --accent-glow: color-mix(in srgb, #f26322 35%, transparent);
        }
        * {
            box-sizing: border-box;
        }
        body {
            padding: 0 0 20px;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.5;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
        }

        /* ── Hero ─────────────────────────────── */
        .hero {
            position: relative;
            padding: 20px 16px 4px;
            text-align: center;
            background:
                radial-gradient(ellipse 100% 80% at 50% 0%, var(--accent-glow), transparent 60%);
        }
        .logo {
            display: inline-block;
            width: 100%;
            max-width: 350px;
            height: auto;
            transition: transform 0.25s ease;
        }
        .logo:hover {
            transform: scale(1.02);
        }
        .logo.hidden {
            display: none;
        }
        .tagline {
            margin: 10px 0 0;
            font-size: 12px;
            opacity: 0.7;
        }
        .status {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 6px;
            margin-top: 12px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            max-width: 100%;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            flex: 0 1 auto;
        }
        .badge-ddev {
            background: color-mix(in srgb, #8957e5 25%, transparent);
            color: var(--vscode-charts-purple, #b180d7);
        }
        .badge-version {
            background: color-mix(in srgb, #28a745 20%, transparent);
            color: #28a745;
        }
        .badge-version.outdated {
            background: color-mix(in srgb, #e51400 20%, transparent);
            color: #e51400;
        }
        .badge-version.dev {
            background: color-mix(in srgb, #e8a838 20%, transparent);
            color: #e8a838;
        }
        .badge-version.unknown {
            background: color-mix(in srgb, #808080 20%, transparent);
            color: var(--vscode-descriptionForeground, #808080);
        }
        .badge-version.hidden {
            display: none;
        }
        .badge-update {
            flex: 0 0 auto;
            padding: 5px 12px;
            background: #238636;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 2px 0 rgba(35, 134, 54, 0.25);
            transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
        }
        .badge-update:hover {
            background: #2ea043;
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(46, 160, 67, 0.35);
        }
        .badge-update:active {
            transform: translateY(0);
            box-shadow: 0 1px 0 rgba(35, 134, 54, 0.25);
        }
        .badge-update.hidden {
            display: none;
        }
        .badge-version.loading {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .badge-version.loading::after {
            content: '';
            width: 12px;
            height: 12px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* ── Sections ─────────────────────────── */
        .section {
            padding: 0 16px;
            margin-top: 22px;
        }
        h2 {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            opacity: 0.55;
            margin: 0 0 10px;
        }
        h2::after {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--vscode-panel-border, currentColor);
            opacity: 0.35;
        }

        /* ── Quick actions ────────────────────── */
        .actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
            gap: 10px;
        }
        .action {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 18px 10px;
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.15));
            border-radius: 8px;
            cursor: pointer;
            text-align: center;
            font-family: inherit;
            font-size: 12px;
            font-weight: 500;
            background: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.04));
            color: var(--vscode-foreground);
            transition: all 0.2s ease;
            overflow: hidden;
        }
        .action::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, var(--accent) 0%, transparent 50%);
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .action:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 25%, transparent);
        }
        .action:hover::before {
            opacity: 0.08;
        }
        .action:active {
            transform: translateY(0) scale(0.98);
            box-shadow: 0 2px 4px color-mix(in srgb, var(--accent) 15%, transparent);
        }
        .action .ti {
            font-size: 24px;
            color: var(--accent);
            transition: transform 0.2s ease;
        }
        .action:hover .ti {
            transform: scale(1.1);
        }
        .action span {
            position: relative;
            z-index: 1;
        }
        .action-add,
        .action-edit {
            border-style: dashed;
            opacity: 0.75;
        }
        .action-add:hover,
        .action-edit:hover {
            opacity: 1;
        }
        .action .action-remove {
            position: absolute;
            top: 4px;
            right: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            border-radius: 4px;
            font-size: 10px;
            line-height: 1;
            color: var(--vscode-descriptionForeground);
            background: transparent;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
            z-index: 2;
        }
        .action:hover .action-remove {
            opacity: 1;
        }
        .action .action-remove:hover {
            color: var(--vscode-errorForeground);
            background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.15));
        }
        .action .action-remove .ti {
            font-size: 10px !important;
            color: inherit !important;
        }
        .action.dragging {
            opacity: 0.5;
            border-style: dashed;
        }
        .action.drag-over {
            border-color: var(--accent);
            background: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.08));
        }

        /* ── Resources ────────────────────────── */
        .links {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .links a {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            margin: 0 -8px;
            border-radius: var(--radius);
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            font-size: 12.5px;
            transition: background 0.15s ease;
        }
        .links a:hover {
            background: var(--vscode-list-hoverBackground);
            text-decoration: none;
        }
        .links a::after {
            content: '↗';
            margin-left: auto;
            font-size: 11px;
            opacity: 0;
            transition: opacity 0.15s ease;
        }
        .links a:hover::after {
            opacity: 0.7;
        }

        .no-workspace {
            margin: 0;
            font-size: 12px;
            opacity: 0.65;
        }
    </style>
</head>
<body>
    <div class="hero">
        <img id="logo-light" class="logo hidden" src="${sloganLightUri}" alt="MageForge">
        <img id="logo-dark" class="logo hidden" src="${sloganDarkUri}" alt="MageForge">
        <p class="tagline">Frontend workflow automation for Magento 2</p>
        ${
            magentoRoot
                ? `<div class="status">
                    ${envBadge}
                    <span id="badge-version" class="badge badge-version loading"></span>
                    <button id="btn-update" class="badge badge-update hidden" data-command="mageforge.updateMageforge">Update</button>
                </div>`
                : ''
        }
    </div>

    ${
        magentoRoot
            ? ''
            : `<div class="section"><p class="no-workspace">Open a Magento 2 project folder to get started.</p></div>`
    }

    <div class="section">
        <h2>Quick Actions</h2>
        <div class="actions">
            ${actionButtons}
            ${manageButtons}
        </div>
    </div>

    <div class="section">
        <h2>Resources</h2>
        <div class="links">
            <a href="${DOCS_URL}">Documentation</a>
            <a href="${CHANGELOG_URL}">Changelog</a>
            <a href="${EXTENSION_ISSUES_URL}">Report Extension Issue</a>
            <a href="${MAGEFORGE_ISSUES_URL}">Report MageForge Issue</a>
            <a href="${WEBSITE_URL}">MageForge on GitHub</a>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Notify the extension as soon as the webview is ready to receive
        // messages. This is more reliable than sending data immediately after
        // setting webview.html, because the webview may not be fully loaded yet
        // when VS Code regains focus or the view is restored.
        vscode.postMessage({ type: 'webviewReady' });

        // Show the logo variant matching the current theme background.
        // MageForge-Slogan.svg is made for dark themes, MageForge-Slogan-dark.svg for light themes.
        const lightLogo = document.getElementById('logo-light');
        const darkLogo = document.getElementById('logo-dark');

        function updateLogo() {
            const isDark = document.body.classList.contains('vscode-dark') ||
                document.body.classList.contains('vscode-high-contrast');
            darkLogo.classList.toggle('hidden', !isDark);
            lightLogo.classList.toggle('hidden', isDark);
        }

        new MutationObserver(updateLogo).observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
        });
        updateLogo();

        document.querySelectorAll('[data-command], [data-url]').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.url) {
                    vscode.postMessage({ url: button.dataset.url });
                } else if (button.dataset.command) {
                    vscode.postMessage({ command: button.dataset.command });
                }
            });
        });

        const addBtn = document.getElementById('btn-add-quick-action');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'addQuickAction' });
            });
        }

        const settingsBtn = document.getElementById('btn-edit-quick-actions');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'settingsQuickActions' });
            });
        }

        document.querySelectorAll('.action-remove').forEach((removeBtn) => {
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                const index = removeBtn.getAttribute('data-remove-index');
                if (index !== null) {
                    vscode.postMessage({ type: 'removeQuickAction', index: parseInt(index, 10) });
                }
            });
        });

        setupDragAndDrop();

        function setupDragAndDrop() {
            const container = document.querySelector('.actions');
            if (!container) {
                return;
            }

            let dragSrcIndex = -1;
            let isDragging = false;

            function getActionButton(target) {
                return target.closest('.action[draggable="true"]');
            }

            function getActionIndex(button) {
                if (!button) {
                    return -1;
                }
                return parseInt(button.getAttribute('data-index') ?? '-1', 10);
            }

            function clearDragOver() {
                container.querySelectorAll('.action.drag-over').forEach((el) => {
                    el.classList.remove('drag-over');
                });
            }

            container.addEventListener('dragstart', (event) => {
                const button = getActionButton(event.target);
                if (!button) {
                    return;
                }
                isDragging = true;
                dragSrcIndex = getActionIndex(button);
                button.classList.add('dragging');
                event.dataTransfer?.setData('text/plain', String(dragSrcIndex));
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                }
            });

            container.addEventListener('dragend', (event) => {
                const button = getActionButton(event.target);
                if (button) {
                    button.classList.remove('dragging');
                }
                clearDragOver();
                dragSrcIndex = -1;
                // Defer clearing the flag so the click event that sometimes
                // follows a drag is suppressed.
                window.requestAnimationFrame(() => {
                    isDragging = false;
                });
            });

            container.addEventListener('dragenter', (event) => {
                const button = getActionButton(event.target);
                if (!button || getActionIndex(button) === dragSrcIndex) {
                    return;
                }
                event.preventDefault();
                button.classList.add('drag-over');
            });

            container.addEventListener('dragleave', (event) => {
                const button = getActionButton(event.target);
                if (!button) {
                    return;
                }
                // Keep the highlight when moving between a button and its
                // child elements (icon, label, remove handle).
                if (getActionButton(event.relatedTarget) === button) {
                    return;
                }
                button.classList.remove('drag-over');
            });

            container.addEventListener('dragover', (event) => {
                event.preventDefault();
                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                }
            });

            container.addEventListener('drop', (event) => {
                event.preventDefault();
                clearDragOver();
                const button = getActionButton(event.target);
                if (!button) {
                    return;
                }
                const dropTargetIndex = getActionIndex(button);
                if (
                    dragSrcIndex === -1 ||
                    dropTargetIndex === -1 ||
                    dragSrcIndex === dropTargetIndex
                ) {
                    return;
                }
                vscode.postMessage({
                    type: 'reorderQuickAction',
                    fromIndex: dragSrcIndex,
                    toIndex: dropTargetIndex,
                });
            });

            // Suppress the click event that some browsers fire right after a
            // drag ends, which would otherwise trigger the dropped-on action.
            container.addEventListener(
                'click',
                (event) => {
                    if (isDragging) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                },
                true,
            );
        }

        // Handle version info from extension
        window.addEventListener('message', (event) => {
            const data = event.data;
            if (data.type === 'versionInfo') {
                const versionBadge = document.getElementById('badge-version');
                const updateBtn = document.getElementById('btn-update');
                versionBadge.classList.remove('loading');
                if (data.mageforge) {
                    let text = 'MageForge CLI v' + data.mageforge;
                    if (data.isDev) {
                        text += ' (dev)';
                        versionBadge.classList.add('dev');
                    } else if (data.latest && data.outdated) {
                        text += ' (outdated)';
                        versionBadge.classList.add('outdated');
                        versionBadge.title = 'Update available: v' + data.mageforge + ' → v' + data.latest;
                        updateBtn.classList.remove('hidden');
                        updateBtn.textContent = 'Update to v' + data.latest;
                        updateBtn.title = 'Update MageForge CLI to v' + data.latest;
                    } else if (data.latest && !data.outdated) {
                        text += ' (latest)';
                    } else {
                        text += ' (update check unavailable)';
                        versionBadge.classList.add('unknown');
                        versionBadge.title = 'Could not reach GitHub to check for updates';
                    }
                    versionBadge.textContent = text;
                } else {
                    versionBadge.classList.add('hidden');
                }
            }
        });
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}
