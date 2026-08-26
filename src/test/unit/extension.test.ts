import * as assert from 'assert';
import mockRequire = require('mock-require');
import * as vscode from 'vscode';
import { getRegisteredCommand } from './setup';
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

type MockCommandsProvider = {
    getAvailableMageforgeCommands: (root: string) => Promise<string[]>;
};

function loadExtension(magentoMock: MockMagento, commandsMock?: MockCommandsProvider) {
    mockRequire('../../magento', magentoMock);
    if (commandsMock) {
        mockRequire('../../commandsProvider', {
            MAGEFORGE_COMMANDS: [
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
                    id: 'mageforge.theme.list',
                    label: 'Theme: List',
                    description: 'mageforge:theme:list',
                    cliCommand: 'mageforge:theme:list',
                    icon: 'list-unordered',
                },
            ],
            CommandsProvider: class CommandsProvider {
                refresh() {}
            },
            ...commandsMock,
        });
    }
    const ext = mockRequire.reRequire('../../extension') as typeof import('../../extension');
    ext.activate({
        extensionUri: { fsPath: '/ext' } as import('vscode').Uri,
        extension: { packageJSON: { version: '1.0.0' } },
        globalState: { get: () => undefined, update: () => Promise.resolve() },
        subscriptions: [],
    } as unknown as import('vscode').ExtensionContext);
    return ext;
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
        mockRequire.stop('../../commandsProvider');
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

        test('does nothing when user cancels theme selection', async () => {
            const { runMageforgeCommand } = loadExtension(mockMagento);
            const themesProvider = createThemesProvider(['Magento/luma']);

            await runMageforgeCommand(
                {
                    id: 'mageforge.theme.build',
                    cliCommand: 'mageforge:theme:build',
                    acceptsThemes: true,
                } as MageforgeCommand,
                themesProvider,
            );

            assert.strictEqual(terminals.length, 0);
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

    suite('addQuickAction command', () => {
        test('adds selected command and icon to quickActions setting', async () => {
            const vscodeMock = vscode as unknown as {
                workspace: {
                    getConfiguration: () => {
                        get: <T>(_key: string, defaultValue?: T) => T | undefined;
                        update: (key: string, value: unknown) => Promise<void>;
                    };
                };
                window: {
                    showQuickPick: <T>(items: T[]) => Promise<T | undefined>;
                    showInformationMessage: () => Promise<undefined>;
                    showErrorMessage: () => Promise<undefined>;
                };
            };

            const updatedSettings: { key: string; value: unknown }[] = [];
            vscodeMock.workspace.getConfiguration = () => ({
                get: <T>(_key: string, defaultValue?: T) => defaultValue as T,
                update: async (key: string, value: unknown) => {
                    updatedSettings.push({ key, value });
                },
            });

            let pickCount = 0;
            const originalShowQuickPick = vscodeMock.window.showQuickPick;
            vscodeMock.window.showQuickPick = async <T>(): Promise<T | undefined> => {
                pickCount++;
                if (pickCount === 1) {
                    return {
                        label: 'Theme: List',
                        description: 'mageforge:theme:list',
                        mageforgeCommand: {
                            id: 'mageforge.theme.list',
                            label: 'Theme: List',
                            description: 'mageforge:theme:list',
                            cliCommand: 'mageforge:theme:list',
                            icon: 'list-unordered',
                        },
                    } as unknown as T;
                }
                return { label: '$(rocket) Rocket', icon: 'rocket' } as unknown as T;
            };

            loadExtension(mockMagento, {
                getAvailableMageforgeCommands: async () => [
                    'mageforge:theme:build',
                    'mageforge:theme:list',
                ],
            });

            try {
                const handler = getRegisteredCommand('mageforge.addQuickAction');
                assert.ok(handler);
                await handler!();

                assert.strictEqual(updatedSettings.length, 1);
                assert.strictEqual(updatedSettings[0].key, 'quickActions');
                assert.deepStrictEqual(updatedSettings[0].value, [
                    {
                        label: 'Theme: List',
                        command: 'mageforge.theme.list',
                        icon: 'rocket',
                    },
                ]);
            } finally {
                vscodeMock.window.showQuickPick = originalShowQuickPick;
            }
        });

        test('does nothing when user cancels icon selection', async () => {
            const vscodeMock = vscode as unknown as {
                workspace: {
                    getConfiguration: () => {
                        get: <T>(_key: string, defaultValue?: T) => T | undefined;
                        update: (key: string, value: unknown) => Promise<void>;
                    };
                };
                window: {
                    showQuickPick: <T>(items: T[]) => Promise<T | undefined>;
                    showInformationMessage: () => Promise<undefined>;
                };
            };

            const updatedSettings: { key: string; value: unknown }[] = [];
            vscodeMock.workspace.getConfiguration = () => ({
                get: <T>(_key: string, defaultValue?: T) => defaultValue as T,
                update: async (key: string, value: unknown) => {
                    updatedSettings.push({ key, value });
                },
            });

            let pickCount = 0;
            const originalShowQuickPick = vscodeMock.window.showQuickPick;
            vscodeMock.window.showQuickPick = async <T>(): Promise<T | undefined> => {
                pickCount++;
                if (pickCount === 1) {
                    return {
                        label: 'Theme: List',
                        description: 'mageforge:theme:list',
                        mageforgeCommand: {
                            id: 'mageforge.theme.list',
                            label: 'Theme: List',
                            description: 'mageforge:theme:list',
                            cliCommand: 'mageforge:theme:list',
                            icon: 'list-unordered',
                        },
                    } as unknown as T;
                }
                return undefined;
            };

            loadExtension(mockMagento, {
                getAvailableMageforgeCommands: async () => ['mageforge:theme:list'],
            });

            try {
                const handler = getRegisteredCommand('mageforge.addQuickAction');
                assert.ok(handler);
                await handler!();
                assert.strictEqual(updatedSettings.length, 0);
            } finally {
                vscodeMock.window.showQuickPick = originalShowQuickPick;
            }
        });

        test('does nothing when no Magento root is found', async () => {
            mockMagento.getMagentoRoot = () => undefined;
            const vscodeMock = vscode as unknown as {
                window: {
                    showErrorMessage: (message: string) => Promise<undefined>;
                };
            };
            const shownErrors: string[] = [];
            const originalShowError = vscodeMock.window.showErrorMessage;
            vscodeMock.window.showErrorMessage = async (message: string) => {
                shownErrors.push(message);
            };

            loadExtension(mockMagento);

            try {
                const handler = getRegisteredCommand('mageforge.addQuickAction');
                assert.ok(handler);
                await handler!();
                assert.strictEqual(shownErrors.length, 1);
                assert.ok(shownErrors[0].includes('No workspace folder'));
            } finally {
                vscodeMock.window.showErrorMessage = originalShowError;
            }
        });

        test('does nothing when user cancels command selection', async () => {
            const vscodeMock = vscode as unknown as {
                workspace: {
                    getConfiguration: () => {
                        get: <T>(_key: string, defaultValue?: T) => T | undefined;
                        update: (key: string, value: unknown) => Promise<void>;
                    };
                };
                window: {
                    showQuickPick: <T>() => Promise<T | undefined>;
                    showInformationMessage: () => Promise<undefined>;
                };
            };

            const updatedSettings: { key: string; value: unknown }[] = [];
            vscodeMock.workspace.getConfiguration = () => ({
                get: <T>(_key: string, defaultValue?: T) => defaultValue as T,
                update: async (key: string, value: unknown) => {
                    updatedSettings.push({ key, value });
                },
            });

            const originalShowQuickPick = vscodeMock.window.showQuickPick;
            vscodeMock.window.showQuickPick = async () => undefined;

            loadExtension(mockMagento, {
                getAvailableMageforgeCommands: async () => ['mageforge:theme:build'],
            });

            try {
                const handler = getRegisteredCommand('mageforge.addQuickAction');
                assert.ok(handler);
                await handler!();
                assert.strictEqual(updatedSettings.length, 0);
            } finally {
                vscodeMock.window.showQuickPick = originalShowQuickPick;
            }
        });
    });

    suite('removeQuickAction command', () => {
        test('removes quick action at given index', async () => {
            const vscodeMock = vscode as unknown as {
                workspace: {
                    getConfiguration: () => {
                        get: <T>(_key: string, defaultValue?: T) => T | undefined;
                        update: (key: string, value: unknown) => Promise<void>;
                    };
                };
                window: { showInformationMessage: () => Promise<undefined> };
            };

            const updatedSettings: { key: string; value: unknown }[] = [];
            vscodeMock.workspace.getConfiguration = () => ({
                get: <T>(_key: string, defaultValue?: T) =>
                    (_key === 'quickActions'
                        ? [
                              { label: 'Build', command: 'mageforge.theme.build', icon: 'hammer' },
                              { label: 'Watch', command: 'mageforge.theme.watch', icon: 'eye' },
                          ]
                        : defaultValue) as T,
                update: async (key: string, value: unknown) => {
                    updatedSettings.push({ key, value });
                },
            });

            loadExtension(mockMagento);

            const handler = getRegisteredCommand('mageforge.removeQuickAction');
            assert.ok(handler);
            await handler!(0);

            assert.strictEqual(updatedSettings.length, 1);
            assert.deepStrictEqual(updatedSettings[0].value, [
                { label: 'Watch', command: 'mageforge.theme.watch', icon: 'eye' },
            ]);
        });

        test('does nothing for out-of-bounds index', async () => {
            const vscodeMock = vscode as unknown as {
                workspace: {
                    getConfiguration: () => {
                        get: <T>(_key: string, defaultValue?: T) => T | undefined;
                        update: (key: string, value: unknown) => Promise<void>;
                    };
                };
            };

            const updatedSettings: { key: string; value: unknown }[] = [];
            vscodeMock.workspace.getConfiguration = () => ({
                get: <T>(_key: string, defaultValue?: T) =>
                    (_key === 'quickActions'
                        ? [{ label: 'Build', command: 'mageforge.theme.build', icon: 'hammer' }]
                        : defaultValue) as T,
                update: async (key: string, value: unknown) => {
                    updatedSettings.push({ key, value });
                },
            });

            loadExtension(mockMagento);

            const handler = getRegisteredCommand('mageforge.removeQuickAction');
            assert.ok(handler);
            await handler!(5);

            assert.strictEqual(updatedSettings.length, 0);
        });
    });

    suite('reorderQuickAction command', () => {
        test('moves quick action from one index to another', async () => {
            const vscodeMock = vscode as unknown as {
                workspace: {
                    getConfiguration: () => {
                        get: <T>(_key: string, defaultValue?: T) => T | undefined;
                        update: (key: string, value: unknown) => Promise<void>;
                    };
                };
            };

            const updatedSettings: { key: string; value: unknown }[] = [];
            vscodeMock.workspace.getConfiguration = () => ({
                get: <T>(_key: string, defaultValue?: T) =>
                    (_key === 'quickActions'
                        ? [
                              { label: 'Build', command: 'mageforge.theme.build', icon: 'hammer' },
                              { label: 'Watch', command: 'mageforge.theme.watch', icon: 'eye' },
                              { label: 'List', command: 'mageforge.theme.list', icon: 'list' },
                          ]
                        : defaultValue) as T,
                update: async (key: string, value: unknown) => {
                    updatedSettings.push({ key, value });
                },
            });

            loadExtension(mockMagento);

            const handler = getRegisteredCommand('mageforge.reorderQuickAction');
            assert.ok(handler);
            await handler!(0, 2);

            assert.strictEqual(updatedSettings.length, 1);
            assert.deepStrictEqual(updatedSettings[0].value, [
                { label: 'Watch', command: 'mageforge.theme.watch', icon: 'eye' },
                { label: 'List', command: 'mageforge.theme.list', icon: 'list' },
                { label: 'Build', command: 'mageforge.theme.build', icon: 'hammer' },
            ]);
        });

        test('does nothing for invalid indices', async () => {
            const vscodeMock = vscode as unknown as {
                workspace: {
                    getConfiguration: () => {
                        get: <T>(_key: string, defaultValue?: T) => T | undefined;
                        update: (key: string, value: unknown) => Promise<void>;
                    };
                };
            };

            const updatedSettings: { key: string; value: unknown }[] = [];
            vscodeMock.workspace.getConfiguration = () => ({
                get: <T>(_key: string, defaultValue?: T) =>
                    (_key === 'quickActions'
                        ? [{ label: 'Build', command: 'mageforge.theme.build', icon: 'hammer' }]
                        : defaultValue) as T,
                update: async (key: string, value: unknown) => {
                    updatedSettings.push({ key, value });
                },
            });

            loadExtension(mockMagento);

            const handler = getRegisteredCommand('mageforge.reorderQuickAction');
            assert.ok(handler);
            await handler!(0, 0);

            assert.strictEqual(updatedSettings.length, 0);
        });
    });

    suite('settingsQuickActions command', () => {
        test('opens VS Code settings with mageforge.quickActions', async () => {
            loadExtension(mockMagento);

            const handler = getRegisteredCommand('mageforge.settingsQuickActions');
            assert.ok(handler);
            await handler!();

            const executed = (vscode.commands as unknown as { executedCommands: string[] })
                .executedCommands;
            assert.ok(executed.includes('workbench.action.openSettings'));
            assert.ok(
                (vscode.commands as unknown as { executedArgs: unknown[] }).executedArgs.some(
                    (args) => Array.isArray(args) && args[0] === 'mageforge',
                ),
            );
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
