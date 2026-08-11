import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CHANGELOG_URL = 'https://github.com/OpenForgeProject/mageforge-vscode/blob/main/CHANGELOG.md';

/**
 * Webview panel that shows the extension changelog after an update.
 */
export class ChangelogViewProvider {
    public static readonly viewType = 'mageforge.changelog';
    private panel: vscode.WebviewPanel | undefined;

    constructor(private readonly extensionUri: vscode.Uri) {}

    /**
     * Reveal the changelog panel. If it is already open, it is brought to front.
     * Optionally pass a title suffix, e.g. the new version number.
     */
    show(subtitle?: string): void {
        const title = subtitle ? `MageForge updated — ${subtitle}` : 'MageForge Changelog';

        if (this.panel) {
            this.panel.title = title;
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            ChangelogViewProvider.viewType,
            title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets')],
            },
        );

        this.panel.webview.html = this.getHtml(this.panel.webview, subtitle);
        this.panel.webview.onDidReceiveMessage((message: { url?: string }) => {
            if (message.url) {
                void vscode.env.openExternal(vscode.Uri.parse(message.url));
            }
        }, undefined);
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private getHtml(webview: vscode.Webview, subtitle?: string): string {
        const content = this.loadChangelog();
        const logoUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets', 'MageForge-Logo.svg'),
        );
        const nonce = getNonce();
        const marketplaceUrl =
            'https://marketplace.visualstudio.com/items?itemName=OpenForgeProject.mageforge';
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
    <style>
        :root {
            --accent: #f26322;
            --accent-glow: color-mix(in srgb, var(--accent) 35%, transparent);
            --radius: 10px;
            --bg-card: var(--vscode-editor-background);
            --border: var(--vscode-panel-border, rgba(128, 128, 128, 0.18));
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 36px 28px 48px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.6;
            color: var(--vscode-foreground);
            background:
                radial-gradient(ellipse 80% 35% at 50% -10%, var(--accent-glow), transparent 60%),
                var(--vscode-editor-background);
        }
        .container {
            max-width: 780px;
            margin: 0 auto;
        }
        .hero {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px 0 30px;
        }
        .hero .badge-new {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            margin-bottom: 20px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--accent);
            background: color-mix(in srgb, var(--accent) 14%, transparent);
            border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
            animation: pulse 2.2s ease-in-out infinite;
        }
        .hero .badge-new::before {
            content: '';
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--accent);
        }
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 35%, transparent); }
            50% { box-shadow: 0 0 0 6px transparent; }
        }
        .logo {
            order: -1;
            width: 96px;
            height: 96px;
            margin: 6px 0 25px;
            filter: drop-shadow(0 10px 24px color-mix(in srgb, var(--accent) 25%, transparent));
            transition: transform 0.35s ease;
        }
        .logo:hover {
            transform: scale(1.06) rotate(-3deg);
        }
        .hero h1 {
            width: 100%;
            text-align: center;
            margin: 0 0 8px;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.02em;
        }
        .hero p {
            width: 100%;
            text-align: center;
            margin: 0;
            opacity: 0.7;
            font-size: 14px;
        }
        .version-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 14px;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border-radius: var(--radius);
            font: inherit;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid var(--border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .btn:hover {
            transform: translateY(-1px);
            background: var(--vscode-button-secondaryHoverBackground);
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: transparent;
        }
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .install-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 420px;
            margin: 18px auto 0;
            padding: 6px 8px 6px 14px;
            border-radius: var(--radius);
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--border);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        .install-bar code {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            direction: rtl;
            text-align: left;
        }
        .install-bar .btn-mini {
            padding: 5px 10px;
            font-size: 11px;
        }
        .changelog {
            margin-top: 34px;
        }
        .changelog-intro {
            margin-bottom: 32px;
            padding: 22px 24px;
            border-radius: var(--radius);
            background: color-mix(in srgb, var(--vscode-sideBar-background) 50%, transparent);
            border: 1px solid var(--border);
        }
        .release {
            position: relative;
            margin-bottom: 32px;
            padding: 22px 24px;
            border-radius: var(--radius);
            background: color-mix(in srgb, var(--vscode-sideBar-background) 50%, transparent);
            border: 1px solid var(--border);
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .release:hover {
            border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
            box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        .release-header {
            position: relative;
            margin-bottom: 16px;
        }
        .release-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 0 0 16px;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.01em;
        }
        .release-heading a {
            color: inherit;
            text-decoration: none;
        }
        .release-heading a:hover {
            color: var(--vscode-textLink-foreground);
        }
        .release-date {
            margin-left: auto;
            font-size: 11px;
            font-weight: 500;
            opacity: 0.55;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .release-latest {
            position: absolute;
            top: 0px;
            right: -55px;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            background: var(--accent);
            color: #fff;
        }
        .category {
            margin-top: 18px;
        }
        .category-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0 0 10px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .category-title i {
            font-size: 15px;
        }
        .cat-features { color: #3fb950; }
        .cat-bugfixes { color: #f85149; }
        .cat-maintenance { color: #a371f7; }
        ul {
            padding-left: 0;
            margin: 0;
            list-style: none;
        }
        li {
            position: relative;
            padding-left: 20px;
            margin: 7px 0;
            font-size: 13px;
            line-height: 1.55;
        }
        li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 9px;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--accent);
            opacity: 0.7;
        }
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        code {
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textCodeBlock-background);
            padding: 1px 4px;
            border-radius: 4px;
        }
        pre {
            padding: 12px 14px;
            border-radius: var(--radius);
            background: var(--vscode-textCodeBlock-background);
            overflow: auto;
        }
        pre code {
            background: transparent;
            padding: 0;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <span class="badge-new">New Release ${subtitle}</span>
            <img class="logo" src="${logoUri}" alt="MageForge">
            <h1>What's new in MageForge</h1>
            <p>See what changed in the latest version of the extension.</p>
            <div class="actions">
                <button class="btn btn-primary" data-url="${marketplaceUrl}">
                    <i class="ti ti-star"></i> Rate on Marketplace
                </button>
                <button class="btn" data-url="${CHANGELOG_URL}">
                    <i class="ti ti-brand-github"></i> Full Changelog
                </button>
                <button class="btn" data-url="${marketplaceUrl}">
                    <i class="ti ti-download"></i> Marketplace
                </button>
            </div>
        </div>

        <div class="changelog">
            ${content}
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        document.querySelectorAll('[data-url]').forEach((el) => {
            el.addEventListener('click', () => {
                vscode.postMessage({ url: el.dataset.url });
            });
        });
    </script>
</body>
</html>`;
    }

    private loadChangelog(): string {
        try {
            const changelogPath = path.join(this.extensionUri.fsPath, 'CHANGELOG.md');
            const raw = fs.readFileSync(changelogPath, 'utf8');
            // Remove the top-level H1 so it does not duplicate the page title.
            const withoutTitle = raw.replace(/^#\s+.*\n+/m, '');
            return this.markdownToHtml(withoutTitle);
        } catch {
            return `<div class="empty-state">Could not load the changelog. <a href="${CHANGELOG_URL}">View it on GitHub</a>.</div>`;
        }
    }

    /**
     * Markdown-to-HTML conversion tailored for the release-please changelog.
     * Wraps each release section in a styled card, adds category icons and a
     * "Latest" badge on the first release block.
     */
    private markdownToHtml(markdown: string): string {
        let html = this.escapeHtml(markdown);

        // Convert fenced code blocks first, before escaping is applied again.
        const codeBlocks: string[] = [];
        html = html.replace(/```[\s\S]*?```/g, (match) => {
            const code = match.replace(/```(\w*)\n?/, '').replace(/```$/, '');
            codeBlocks.push(`<pre><code>${this.escapeHtml(code.trim())}</code></pre>`);
            return `\u0000CODEBLOCK${codeBlocks.length - 1}\u0000`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        // Split into top-level release sections (## ...). Content before the first
        // release heading is preserved as an intro block, not treated as a release.
        const releases: string[] = [];
        let introHtml = '';
        const sections = html.split(/^##\s+/gm);
        const leadingContent = sections.shift();
        if (leadingContent && leadingContent.trim()) {
            introHtml = `<div class="changelog-intro">${this.wrapListItems(this.replaceCategoryHeaders(leadingContent.trim()))}</div>`;
        }

        sections.forEach((section, index) => {
            const lines = section.split('\n');
            const headingLine = lines[0];
            const rest = lines.slice(1).join('\n');

            // Extract version + optional compare link
            const headingMatch = headingLine.match(/^\[?([^\]]+)\]?\s*(?:\(([^)]+)\))?/);
            const version = headingMatch ? headingMatch[1] : 'Release';
            const compareUrl = headingMatch?.[2];
            const dateMatch = headingLine.match(/(\d{4}-\d{2}-\d{2})/);

            const body = this.wrapListItems(this.replaceCategoryHeaders(rest));

            const latestBadge = index === 0 ? '<span class="release-latest">Latest</span>' : '';
            const heading = compareUrl ? `<a href="${this.escapeHtmlAttribute(compareUrl)}">${version}</a>` : version;

            const releaseHeader = `<header class="release-header">${latestBadge}<h2 class="release-heading">${heading}</h2></header>`;
            releases.push(`<article class="release">${releaseHeader}${body}</article>`);
        });

        const releasesHtml =
            releases.length > 0
                ? releases.join('\n')
                : `<div class="empty-state">No release notes available.</div>`;
        let output = `${introHtml}${releasesHtml}`;

        // Restore fenced code blocks
        codeBlocks.forEach((block, index) => {
            output = output.replace(`\u0000CODEBLOCK${index}\u0000`, block);
        });

        return output;
    }

    private replaceCategoryHeaders(body: string): string {
        const categories: Record<string, { title: string; cssClass: string; icon: string }> = {
            Features: { title: 'Features', cssClass: 'cat-features', icon: 'ti-sparkles' },
            'Bug Fixes': { title: 'Bug Fixes', cssClass: 'cat-bugfixes', icon: 'ti-bug' },
            Maintenance: { title: 'Maintenance', cssClass: 'cat-maintenance', icon: 'ti-tools' },
        };

        return body.replace(/^###\s+(.+)$/gm, (match, title) => {
            const category = categories[title];
            if (category) {
                return this.categoryHeader(category.title, category.cssClass, category.icon);
            }
            return `<h3>${title}</h3>`;
        });
    }

    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    private escapeHtmlAttribute(text: string): string {
        return this.escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    private categoryHeader(title: string, cssClass: string, icon: string): string {
        return `<div class="category"><h3 class="category-title ${cssClass}"><i class="ti ${icon}"></i> ${title}</h3>`;
    }

    private wrapListItems(body: string): string {
        // Group list items into <ul> blocks. Release-please sometimes emits
        // multiple "* ..." entries on a single line; split those first.
        const lines = body.split('\n');
        const out: string[] = [];
        let inList = false;
        let inCategory = false;

        const closeList = () => {
            if (inList) {
                out.push('</ul>');
                inList = false;
            }
        };
        const closeCategory = () => {
            closeList();
            if (inCategory) {
                out.push('</div>');
                inCategory = false;
            }
        };

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();

            if (trimmed.startsWith('<div class="category"')) {
                closeCategory();
                out.push(rawLine);
                inCategory = true;
                continue;
            }

            const listMatch = rawLine.match(/^(\s*)[*\-]\s+(.+)$/);
            if (listMatch) {
                const items = this.splitListLine(listMatch[2]);
                if (!inList) {
                    out.push('<ul>');
                    inList = true;
                }
                for (const item of items) {
                    out.push(`<li>${item}</li>`);
                }
                continue;
            }

            closeList();

            if (trimmed === '') {
                continue;
            }

            out.push(rawLine);
        }

        closeCategory();
        return out.join('\n');
    }

    /**
     * Release-please occasionally joins bullet points on one line:
     *   * first item ([abc123]) * second item ([def456])
     * Split them while preserving links that contain " * " in their text.
     */
    private splitListLine(line: string): string[] {
        const items: string[] = [];
        const pattern = /(?:^|\s)\*\s+/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(line)) !== null) {
            const start = match.index + match[0].indexOf('*');
            if (start > lastIndex) {
                items.push(line.slice(lastIndex, start).trim());
            }
            lastIndex = pattern.lastIndex;
        }

        if (lastIndex < line.length) {
            items.push(line.slice(lastIndex).trim());
        }

        return items.filter((item) => item.length > 0);
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
