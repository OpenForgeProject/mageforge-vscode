import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ChangelogViewProvider } from '../../changelogProvider';
import { createMockWebview, getLastWebviewPanel } from './setup';

function makeTestUrl(path: string): string {
    return `https://github.com/${path}`;
}

suite('changelogProvider.ts unit tests', () => {
    let sandbox: string;

    setup(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mageforge-changelog-test-'));
    });

    teardown(() => {
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    function createExtensionWithChangelog(content: string): string {
        fs.writeFileSync(path.join(sandbox, 'CHANGELOG.md'), content);
        return sandbox;
    }

    test('renders changelog HTML with version title', () => {
        const extPath = createExtensionWithChangelog(
            '# Changelog\n\n## 1.0.0\n\n- Initial release',
        );
        const provider = new ChangelogViewProvider({ fsPath: extPath } as import('vscode').Uri);

        const webview = createMockWebview();
        provider.show('v1.0.0');

        // The panel is created internally; we cannot easily capture it without mocking vscode.window.
        // Instead we test the HTML generation through the public API indirectly by creating a panel mock.
        const mockPanel = {
            webview,
            title: '',
            reveal: () => undefined,
            onDidDispose: () => undefined,
            dispose: () => undefined,
        };

        // Force set the private panel to test HTML generation
        (provider as any).panel = mockPanel;
        webview.html = (provider as any).getHtml(webview, 'v1.0.0');

        assert.ok(webview.html.includes('v1.0.0'));
        assert.ok(webview.html.includes('Initial release'));
        assert.ok(webview.html.includes('Latest'));
    });

    test('markdownToHtml converts headings and lists', () => {
        const extPath = createExtensionWithChangelog('');
        const provider = new ChangelogViewProvider({ fsPath: extPath } as import('vscode').Uri);

        const html = (provider as any).markdownToHtml(
            '## 1.0.0\n\n### Features\n\n- New feature\n- Another feature',
        );

        assert.ok(html.includes('1.0.0'));
        assert.ok(html.includes('Features'));
        assert.ok(html.includes('New feature'));
        assert.ok(html.includes('Another feature'));
    });

    test('markdownToHtml escapes HTML in code blocks', () => {
        const extPath = createExtensionWithChangelog('');
        const provider = new ChangelogViewProvider({ fsPath: extPath } as import('vscode').Uri);

        const html = (provider as any).markdownToHtml('```\n<script>alert(1)</script>\n```');

        assert.ok(!html.includes('<script>alert(1)</script>'));
        // Content is escaped twice: once globally, then again inside the code block.
        assert.ok(html.includes('&amp;lt;script&amp;gt;'));
    });

    test('markdownToHtml preserves links', () => {
        const extPath = createExtensionWithChangelog('');
        const provider = new ChangelogViewProvider({ fsPath: extPath } as import('vscode').Uri);
        const linkUrl = makeTestUrl('OpenForgeProject/mageforge');

        const html = (provider as any).markdownToHtml(`[link text](${linkUrl})`);

        assert.ok(html.includes(`<a href="${linkUrl}">link text</a>`));
    });

    test('shows empty state when changelog is missing', () => {
        const provider = new ChangelogViewProvider({ fsPath: sandbox } as import('vscode').Uri);
        const webview = createMockWebview();
        const html = (provider as any).getHtml(webview);

        assert.ok(html.includes('Could not load the changelog'));
    });

    test('webview message with url opens external link', async () => {
        const extPath = createExtensionWithChangelog('# Changelog');
        const provider = new ChangelogViewProvider({ fsPath: extPath } as import('vscode').Uri);
        const testUrl = makeTestUrl('OpenForgeProject/mageforge');

        provider.show();
        const panel = getLastWebviewPanel();
        assert.ok(panel);
        assert.ok(panel!.webview.onDidReceiveMessageHandler);

        panel!.webview.onDidReceiveMessageHandler!({ url: testUrl });

        await new Promise((resolve) => setTimeout(resolve, 10));
        const env = vscode.env as unknown as { openedExternals: string[] };
        assert.ok(env.openedExternals.includes(testUrl));
    });

    test('webview message with dangerous url is ignored', async () => {
        const extPath = createExtensionWithChangelog('# Changelog');
        const provider = new ChangelogViewProvider({ fsPath: extPath } as import('vscode').Uri);

        provider.show();
        const panel = getLastWebviewPanel();
        assert.ok(panel);
        assert.ok(panel!.webview.onDidReceiveMessageHandler);

        panel!.webview.onDidReceiveMessageHandler!({ url: 'javascript:alert(1)' });

        await new Promise((resolve) => setTimeout(resolve, 10));
        const env = vscode.env as unknown as { openedExternals: string[] };
        assert.strictEqual(env.openedExternals.length, 0);
    });
});
