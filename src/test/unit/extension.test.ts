import * as assert from 'assert';
import mockRequire = require('mock-require');
import * as vscode from 'vscode';
import type { MageforgeCommand } from '../../commandsProvider';
import type { ThemesProvider } from '../../themesProvider';
import { ThemeTreeItem } from '../../themesProvider';

type CapturedTerminal = { name: string; command: string; cwd: string };
type MockMagento = {
    getMagentoRoot: () => string | undefined;
    buildCommandLine: (root: string, command: string, args: string[]) => string;
    buildComposerUpdateCommand: (root: string, packageName?: string) => string;
    runInTerminal: (name: string, command: string, cwd: string) => void;
};

function loadExtension(magentoMock: MockMagento) {
    mockRequire('../../magento', magentoMock);
    return mockRequire.reRequire('../../extension') as typeof import('../../extension');
}

function createThemesProvider(themeCodes: string[] = []): ThemesProvider {
    return {
        getThemeCodes: async () => themeCodes,
    } as unknown as ThemesProvider;
}

suite('extension.ts unit tests', () => {
    let terminals: CapturedTerminal[];
    let mockMagento: MockMagento;

    setup(() => {
        terminals = [];
        mockMagento = {
            getMagentoRoot: () => '/magento',
            buildCommandLine: (_root, command, args) =>
                `php bin/magento ${command} ${args.join(' ')}`,
            buildComposerUpdateCommand: (_root, packageName) =>
                `composer update ${packageName ?? 'openforgeproject/mageforge'}`,
            runInTerminal: (name, command, cwd) => {
                terminals.push({ name, command, cwd });
            },
        };
    });

    teardown(() => {
        mockRequire.stop('../../magento');
    });

    suite('runMageforgeCommand', () => {
        test('runs command with theme from tree item', async () => {
            const { runMageforgeCommand } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider(['Magento/luma']);

            const item = new ThemeTreeItem({ code: 'Magento/luma' });
            await runMageforgeCommand(
                {
                    id: 'mageforge.theme.build',
                    cliCommand: 'mageforge:theme:build',
                    acceptsThemes: true,
                } as MageforgeCommand,
                themesProvider,
                item,
            );

            assert.strictEqual(terminals.length, 1);
            assert.ok(terminals[0].command.includes('mageforge:theme:build'));
            assert.ok(terminals[0].command.includes('Magento/luma'));
        });

        test('runs command without theme argument when not required', async () => {
            const { runMageforgeCommand } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider([]);

            await runMageforgeCommand(
                {
                    id: 'mageforge.theme.list',
                    cliCommand: 'mageforge:theme:list',
                } as MageforgeCommand,
                themesProvider,
            );

            assert.strictEqual(terminals.length, 1);
            assert.ok(terminals[0].command.includes('mageforge:theme:list'));
            assert.ok(!terminals[0].command.includes('Magento'));
        });

        test('uses watch terminal name for watch commands', async () => {
            const { runMageforgeCommand } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider(['Magento/luma']);

            const item = new ThemeTreeItem({ code: 'Magento/luma' });
            await runMageforgeCommand(
                {
                    id: 'mageforge.theme.watch',
                    cliCommand: 'mageforge:theme:watch',
                    label: 'Theme: Watch',
                    acceptsThemes: true,
                    isWatch: true,
                } as MageforgeCommand,
                themesProvider,
                item,
            );

            assert.strictEqual(terminals[0].name, 'MageForge: Theme: Watch');
        });

        test('does nothing when no Magento root is found', async () => {
            mockMagento.getMagentoRoot = () => undefined;
            const { runMageforgeCommand } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider([]);

            await runMageforgeCommand(
                {
                    id: 'mageforge.theme.list',
                    cliCommand: 'mageforge:theme:list',
                } as MageforgeCommand,
                themesProvider,
            );

            assert.strictEqual(terminals.length, 0);
        });
    });

    suite('overrideFile', () => {
        test('runs template override for selected file and theme', async () => {
            const { overrideFile } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider(['Magento/luma']);

            const mockVscode = vscode as unknown as {
                window: {
                    showQuickPick: (items: string[]) => Promise<string | undefined>;
                };
            };
            const originalShowQuickPick = mockVscode.window.showQuickPick;
            mockVscode.window.showQuickPick = async () => 'Magento/luma';

            try {
                await overrideFile(
                    { fsPath: '/path/to/file.phtml', path: '/path/to/file.phtml' } as vscode.Uri,
                    themesProvider,
                );

                assert.strictEqual(terminals.length, 1);
                assert.ok(terminals[0].command.includes('mageforge:template:override'));
                assert.ok(terminals[0].command.includes('/path/to/file.phtml'));
                assert.ok(terminals[0].command.includes('Magento/luma'));
            } finally {
                mockVscode.window.showQuickPick = originalShowQuickPick;
            }
        });

        test('does nothing when user cancels theme selection', async () => {
            const { overrideFile } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider(['Magento/luma']);

            const mockVscode = vscode as unknown as {
                window: {
                    showQuickPick: (items: string[]) => Promise<string | undefined>;
                };
            };
            const originalShowQuickPick = mockVscode.window.showQuickPick;
            mockVscode.window.showQuickPick = async () => undefined;

            try {
                await overrideFile(
                    { fsPath: '/path/to/file.phtml', path: '/path/to/file.phtml' } as vscode.Uri,
                    themesProvider,
                );
                assert.strictEqual(terminals.length, 0);
            } finally {
                mockVscode.window.showQuickPick = originalShowQuickPick;
            }
        });

        test('does nothing when no file is selected', async () => {
            const { overrideFile } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider([]);

            await overrideFile(undefined, themesProvider);
            assert.strictEqual(terminals.length, 0);
        });
    });

    suite('showUpdateNotificationIfNeeded', () => {
        test('shows changelog and notification when version changed', async () => {
            const { showUpdateNotificationIfNeeded } = loadExtension(mockMagento);
            const shownSubtitles: string[] = [];
            const changelogProvider = {
                show: (subtitle?: string) => {
                    shownSubtitles.push(subtitle ?? '');
                },
            } as import('../../changelogProvider').ChangelogViewProvider;

            const context = {
                extension: { packageJSON: { version: '1.0.0' } },
                globalState: {
                    get: () => '0.9.0',
                    update: () => Promise.resolve(),
                },
            } as unknown as vscode.ExtensionContext;

            const mockVscode = vscode as unknown as {
                window: {
                    showInformationMessage: () => Promise<string | undefined>;
                };
            };
            const originalShowInfo = mockVscode.window.showInformationMessage;
            mockVscode.window.showInformationMessage = async () => 'Dismiss';

            try {
                await showUpdateNotificationIfNeeded(context, changelogProvider);
                assert.strictEqual(shownSubtitles.length, 1);
                assert.strictEqual(shownSubtitles[0], 'v1.0.0');
            } finally {
                mockVscode.window.showInformationMessage = originalShowInfo;
            }
        });

        test('does nothing on first activation', async () => {
            const { showUpdateNotificationIfNeeded } = loadExtension(mockMagento);
            const shownSubtitles: string[] = [];
            const changelogProvider = {
                show: (subtitle?: string) => {
                    shownSubtitles.push(subtitle ?? '');
                },
            } as import('../../changelogProvider').ChangelogViewProvider;

            const context = {
                extension: { packageJSON: { version: '1.0.0' } },
                globalState: {
                    get: () => undefined,
                    update: () => Promise.resolve(),
                },
            } as unknown as vscode.ExtensionContext;

            await showUpdateNotificationIfNeeded(context, changelogProvider);
            assert.strictEqual(shownSubtitles.length, 0);
        });
    });
});
