import * as assert from 'assert';
import mockRequire = require('mock-require');
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createMockWebviewView, restoreVscodeMock } from './setup';

function makeTestUrl(path: string): string {
    return `https://github.com/${path}`;
}

type MockMagento = {
    getMagentoRoot: () => string | undefined;
    getExecutionEnvironment: (root: string) => string;
};

function loadWelcomeProvider(magentoMock: MockMagento) {
    mockRequire('../../magento', magentoMock);
    return mockRequire.reRequire('../../welcomeProvider') as typeof import('../../welcomeProvider');
}

suite('welcomeProvider.ts unit tests', () => {
    let sandbox: string;

    setup(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mageforge-welcome-test-'));
    });

    teardown(() => {
        mockRequire.stop('../../magento');
        restoreVscodeMock();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    function createMagentoRoot(): string {
        fs.mkdirSync(path.join(sandbox, 'bin', 'magento'), { recursive: true });
        return sandbox;
    }

    test('renders welcome HTML with environment badge', async () => {
        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'ddev',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        assert.ok(view.webview.html.includes('DDEV'));
        assert.ok(view.webview.html.includes('Build Theme'));
        assert.ok(view.webview.html.includes('mageforge.theme.build'));
    });

    test('renders configured quick actions', async () => {
        const vscode = require('vscode');
        vscode.workspace.getConfiguration = () => ({
            get: <T>(_key: string, defaultValue?: T): T => defaultValue as T,
        });

        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        assert.ok(view.webview.html.includes('Build Theme'));
        assert.ok(view.webview.html.includes('Rate'));
    });

    test('falls back to defaults when quick actions setting is empty', async () => {
        const vscode = require('vscode');
        vscode.workspace.getConfiguration = () => ({
            get: <T>(_key: string, defaultValue?: T): T => defaultValue as T,
        });

        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        assert.ok(view.webview.html.includes('Build Theme'));
        assert.ok(view.webview.html.includes('Feature Request'));
    });

    test('filters invalid quick actions from settings', async () => {
        const vscode = require('vscode');
        vscode.workspace.getConfiguration = () => ({
            get: <T>(_key: string, defaultValue?: T): T =>
                [
                    { label: 'Valid', command: 'mageforge.theme.build', icon: 'hammer' },
                    { label: 'Bad URL', url: 'javascript:alert(1)', icon: 'bug' },
                    { label: 'No action', icon: 'bug' },
                    {
                        label: 'External command',
                        command: 'workbench.action.closeAllEditors',
                        icon: 'bug',
                    },
                ] as unknown as T,
        });

        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        assert.ok(view.webview.html.includes('Valid'));
        assert.ok(!view.webview.html.includes('Bad URL'));
        assert.ok(!view.webview.html.includes('No action'));
        assert.ok(!view.webview.html.includes('External command'));
    });

    test('renders remove buttons and add/edit buttons when Magento root exists', async () => {
        const vscode = require('vscode');
        vscode.workspace.getConfiguration = () => ({
            get: <T>(_key: string, defaultValue?: T): T => defaultValue as T,
        });

        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        assert.ok(view.webview.html.includes('data-remove-index="0"'));
        assert.ok(view.webview.html.includes('btn-add-quick-action'));
        assert.ok(view.webview.html.includes('btn-edit-quick-actions'));
    });

    test('does not render manage buttons without Magento root', async () => {
        const vscode = require('vscode');
        vscode.workspace.getConfiguration = () => ({
            get: <T>(_key: string, defaultValue?: T): T => defaultValue as T,
        });

        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => undefined,
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        assert.ok(!view.webview.html.includes('<button class="action action-add"'));
        assert.ok(!view.webview.html.includes('<button class="action action-edit"'));
        assert.ok(!view.webview.html.includes('class="action-remove"'));
    });

    test('handles webviewReady message by sending version info', async () => {
        const root = createMagentoRoot();
        fs.mkdirSync(path.join(root, 'vendor', 'composer'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'vendor', 'composer', 'installed.json'),
            JSON.stringify({
                packages: [{ name: 'openforgeproject/mageforge', version: '1.2.3' }],
            }),
        );

        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => root,
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        assert.ok(view.webview.onDidReceiveMessageHandler);
        view.webview.onDidReceiveMessageHandler!({ type: 'webviewReady' });

        // Wait for async version check with a small poll. The version check
        // spawns curl, which can be slow on some runs, so we allow extra time.
        let versionMessage = view.webview.messages.find((m) => m.type === 'versionInfo');
        for (let i = 0; i < 200 && !versionMessage; i++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            versionMessage = view.webview.messages.find((m) => m.type === 'versionInfo');
        }

        assert.ok(versionMessage, `messages: ${JSON.stringify(view.webview.messages)}`);
        assert.strictEqual(versionMessage.mageforge, '1.2.3');
    });

    test('webview message with url opens external link', async () => {
        const vscode = require('vscode');
        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);
        const testUrl = makeTestUrl('OpenForgeProject/mageforge');

        view.webview.onDidReceiveMessageHandler!({
            url: testUrl,
        });

        await new Promise((resolve) => setTimeout(resolve, 10));
        assert.ok(vscode.env.openedExternals.includes(testUrl));
    });

    test('webview message with dangerous url is ignored', async () => {
        const vscode = require('vscode');
        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        view.webview.onDidReceiveMessageHandler!({
            url: 'javascript:alert(1)',
        });

        await new Promise((resolve) => setTimeout(resolve, 10));
        assert.strictEqual(vscode.env.openedExternals.length, 0);
    });

    test('webview message with command executes command', async () => {
        const vscode = require('vscode');
        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => createMagentoRoot(),
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        const view = createMockWebviewView();
        await provider.resolveWebviewView(view as unknown as import('vscode').WebviewView);

        view.webview.onDidReceiveMessageHandler!({
            command: 'mageforge.theme.build',
        });

        await new Promise((resolve) => setTimeout(resolve, 10));
        assert.ok(vscode.commands.executedCommands.includes('mageforge.theme.build'));
    });

    test('isOutdated detects older versions', async () => {
        const { WelcomeViewProvider } = loadWelcomeProvider({
            getMagentoRoot: () => undefined,
            getExecutionEnvironment: () => 'local',
        });

        const provider = new WelcomeViewProvider({ fsPath: '/ext' } as import('vscode').Uri);
        assert.strictEqual((provider as any).isOutdated('1.2.3', '1.2.4'), true);
        assert.strictEqual((provider as any).isOutdated('1.2.3', '1.3.0'), true);
        assert.strictEqual((provider as any).isOutdated('1.2.3', '2.0.0'), true);
        assert.strictEqual((provider as any).isOutdated('1.2.3', '1.2.3'), false);
        assert.strictEqual((provider as any).isOutdated('1.2.3', '1.2.2'), false);
    });
});
