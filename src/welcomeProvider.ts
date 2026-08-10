import * as vscode from 'vscode';
import { getMagentoRoot, useDdev } from './magento';

interface QuickAction {
    label: string;
    command: string;
    icon: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    { label: 'Build Theme', command: 'mageforge.theme.build', icon: 'tools' },
    { label: 'Watch Theme', command: 'mageforge.theme.watch', icon: 'eye' },
    { label: 'System Check', command: 'mageforge.system.check', icon: 'pulse' },
    { label: 'Hyvä Tokens', command: 'mageforge.hyva.tokens', icon: 'symbol-color' },
];

const DOCS_URL = 'https://github.com/OpenForgeProject/mageforge/blob/main/docs/';
const ISSUES_URL = 'https://github.com/OpenForgeProject/mageforge/issues';
const WEBSITE_URL = 'https://github.com/OpenForgeProject/mageforge';

/**
 * Webview-based welcome view shown at the top of the MageForge sidebar.
 * Displays the MageForge header logo, project status, quick actions and links.
 */
export class WelcomeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'mageforge.welcome';

    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets')],
        };

        webviewView.webview.onDidReceiveMessage((message: { command?: string }) => {
            if (message.command) {
                void vscode.commands.executeCommand(message.command);
            }
        });

        webviewView.webview.html = this.getHtml(webviewView.webview);
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
        const ddev = magentoRoot ? useDdev(magentoRoot) : false;
        const ddevBadge = ddev
            ? '<span class="badge badge-ddev">DDEV</span>'
            : '<span class="badge">local PHP</span>';

        const actionButtons = QUICK_ACTIONS.map(
            (action) => `
            <button class="action" data-command="${action.command}">
                <span class="codicon codicon-${action.icon}"></span>
                <span>${action.label}</span>
                <span class="codicon codicon-chevron-right chevron"></span>
            </button>`,
        ).join('');

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --gap: 16px;
            --radius: 6px;
            --accent: #f26322;
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
        }

        /* ── Hero ─────────────────────────────── */
        .hero {
            padding: 20px 16px 4px;
            text-align: center;
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
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .action {
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-panel-border, transparent);
            border-radius: var(--radius);
            cursor: pointer;
            text-align: left;
            font-family: inherit;
            font-size: 12.5px;
            font-weight: 500;
            background: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.06));
            color: var(--vscode-foreground);
            transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
        }
        .action:hover {
            border-color: var(--accent);
            background: color-mix(in srgb, var(--accent) 10%, transparent);
        }
        .action:active {
            transform: scale(0.985);
        }
        .action .codicon {
            font-size: 14px;
            color: var(--accent);
        }
        .action .chevron {
            margin-left: auto;
            opacity: 0;
            transition: opacity 0.15s ease, transform 0.15s ease;
            transform: translateX(-4px);
        }
        .action:hover .chevron {
            opacity: 0.6;
            transform: translateX(0);
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
        ${magentoRoot ? `<div class="status">${ddevBadge}</div>` : ''}
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
            <a href="${ISSUES_URL}">Report an Issue</a>
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
                vscode.postMessage({ command: button.dataset.command });
            });
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
