import * as vscode from 'vscode';
import { getMagentoRoot, getExecutionEnvironment } from './magento';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface QuickAction {
    label: string;
    command?: string;
    url?: string;
    icon: string;
}

const QUICK_ACTIONS: QuickAction[] = [
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
            (message: { command?: string; url?: string; type?: string }) => {
                if (message.url) {
                    void vscode.env.openExternal(vscode.Uri.parse(message.url));
                } else if (message.command) {
                    void vscode.commands.executeCommand(message.command);
                }
            },
        );

        webviewView.webview.html = this.getHtml(webviewView.webview);
        await this.sendVersionInfo(webviewView.webview);
    }

    private async sendVersionInfo(webview: vscode.Webview): Promise<void> {
        const magentoRoot = getMagentoRoot();
        if (!magentoRoot) {
            return;
        }

        const installedVersion = await this.getMageforgeVersion(magentoRoot);
        const isDev = installedVersion?.startsWith('dev-') ?? false;
        const latestVersion = isDev ? undefined : await this.getLatestMageforgeVersion();
        const outdated =
            !isDev && installedVersion && latestVersion
                ? this.isOutdated(installedVersion, latestVersion)
                : false;

        void webview.postMessage({
            type: 'versionInfo',
            mageforge: installedVersion,
            latest: latestVersion,
            outdated,
            isDev,
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

        const actionButtons = QUICK_ACTIONS.map(
            (action) => `
            <button class="action" ${action.command ? `data-command="${action.command}"` : ''} ${action.url ? `data-url="${action.url}"` : ''} title="${action.label}">
                <i class="ti ti-${action.icon}"></i>
                <span>${action.label}</span>
            </button>`,
        ).join('');

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
            justify-content: center;
            gap: 6px;
            margin-top: 12px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 500;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .badge::before {
            content: '';
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
            opacity: 0.8;
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

        document.querySelectorAll('.action').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.url) {
                    vscode.postMessage({ url: button.dataset.url });
                } else if (button.dataset.command) {
                    vscode.postMessage({ command: button.dataset.command });
                }
            });
        });

        // Handle version info from extension
        window.addEventListener('message', (event) => {
            const data = event.data;
            if (data.type === 'versionInfo') {
                const versionBadge = document.getElementById('badge-version');
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
