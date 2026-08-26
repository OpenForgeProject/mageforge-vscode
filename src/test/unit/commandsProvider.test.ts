import * as assert from 'assert';
import mockRequire = require('mock-require');
import type { MageforgeCommand } from '../../commandsProvider';

type MockMagento = {
    getMagentoRoot: () => string | undefined;
    execMageforge: (root: string, command: string, args?: string[]) => Promise<string>;
};

function loadCommandsProvider(magentoMock: MockMagento) {
    mockRequire('../../magento', magentoMock);
    return mockRequire.reRequire(
        '../../commandsProvider',
    ) as typeof import('../../commandsProvider');
}

suite('commandsProvider.ts unit tests', () => {
    teardown(() => {
        mockRequire.stop('../../magento');
    });

    suite('MAGEFORGE_COMMANDS', () => {
        test('contains expected commands', () => {
            const { MAGEFORGE_COMMANDS } = loadCommandsProvider({
                getMagentoRoot: () => undefined,
                execMageforge: async () => '',
            });

            const ids = MAGEFORGE_COMMANDS.map((cmd) => cmd.id);
            assert.ok(ids.includes('mageforge.theme.build'));
            assert.ok(ids.includes('mageforge.theme.watch'));
            assert.ok(ids.includes('mageforge.theme.clean'));
            assert.ok(ids.includes('mageforge.system.version'));
        });

        test('theme commands accept themes', () => {
            const { MAGEFORGE_COMMANDS } = loadCommandsProvider({
                getMagentoRoot: () => undefined,
                execMageforge: async () => '',
            });

            const themeCommands = MAGEFORGE_COMMANDS.filter((cmd) => cmd.acceptsThemes);
            const ids = themeCommands.map((cmd) => cmd.id);
            assert.deepStrictEqual(ids.sort(), ['mageforge.theme.build', 'mageforge.theme.watch']);
        });

        test('watch command is marked as watch', () => {
            const { MAGEFORGE_COMMANDS } = loadCommandsProvider({
                getMagentoRoot: () => undefined,
                execMageforge: async () => '',
            });

            const watch = MAGEFORGE_COMMANDS.find((cmd) => cmd.id === 'mageforge.theme.watch');
            assert.strictEqual(watch?.isWatch, true);
        });
    });

    suite('getAvailableMageforgeCommands', () => {
        test('parses raw command list output', async () => {
            const { getAvailableMageforgeCommands } = loadCommandsProvider({
                getMagentoRoot: () => '/magento',
                execMageforge: async () =>
                    'mageforge:theme:build   Builds a theme\nmageforge:theme:list\nmageforge:system:version',
            });

            const available = await getAvailableMageforgeCommands('/magento');

            assert.deepStrictEqual(available.sort(), [
                'mageforge:system:version',
                'mageforge:theme:build',
                'mageforge:theme:list',
            ]);
        });
    });

    suite('CommandsProvider', () => {
        test('shows only commands reported by the CLI', async () => {
            const { CommandsProvider, MAGEFORGE_COMMANDS } = loadCommandsProvider({
                getMagentoRoot: () => '/magento',
                execMageforge: async () =>
                    'mageforge:theme:build\nmageforge:theme:watch\nmageforge:system:version',
            });

            const provider = new CommandsProvider();
            const children = await provider.getChildren();

            assert.strictEqual(children.length, 3);
            const ids = children.map((child) => child.mageforgeCommand?.id);
            assert.deepStrictEqual(ids.sort(), [
                'mageforge.system.version',
                'mageforge.theme.build',
                'mageforge.theme.watch',
            ]);
        });

        test('shows info message when no Magento root is found', async () => {
            const { CommandsProvider } = loadCommandsProvider({
                getMagentoRoot: () => undefined,
                execMageforge: async () => '',
            });

            const provider = new CommandsProvider();
            const children = await provider.getChildren();

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].mageforgeCommand, undefined);
            assert.ok(children[0].label?.toString().includes('Magento workspace'));
        });

        test('shows user-friendly error when CLI call fails', async () => {
            const { CommandsProvider } = loadCommandsProvider({
                getMagentoRoot: () => '/magento',
                execMageforge: async () => {
                    throw new Error('ddev is not running');
                },
            });

            const provider = new CommandsProvider();
            const children = await provider.getChildren();

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].mageforgeCommand, undefined);
            assert.ok(children[0].label?.toString().includes('DDEV'));
        });

        test('caches available commands across multiple getChildren calls', async () => {
            let calls = 0;
            const { CommandsProvider } = loadCommandsProvider({
                getMagentoRoot: () => '/magento',
                execMageforge: async () => {
                    calls++;
                    return 'mageforge:theme:build';
                },
            });

            const provider = new CommandsProvider();
            await provider.getChildren();
            await provider.getChildren();

            assert.strictEqual(calls, 1);
        });

        test('refresh clears cache and reloads commands', async () => {
            let calls = 0;
            const { CommandsProvider } = loadCommandsProvider({
                getMagentoRoot: () => '/magento',
                execMageforge: async () => {
                    calls++;
                    return calls === 1
                        ? 'mageforge:theme:build'
                        : 'mageforge:theme:build\nmageforge:theme:watch';
                },
            });

            const provider = new CommandsProvider();
            const first = await provider.getChildren();
            assert.strictEqual(first.length, 1);

            provider.refresh();
            const second = await provider.getChildren();
            assert.strictEqual(second.length, 2);
            assert.strictEqual(calls, 2);
        });
    });

    suite('CommandTreeItem', () => {
        test('sets label, description and command', () => {
            const { CommandTreeItem, MAGEFORGE_COMMANDS } = loadCommandsProvider({
                getMagentoRoot: () => undefined,
                execMageforge: async () => '',
            });

            const cmd = MAGEFORGE_COMMANDS[0];
            const item = new CommandTreeItem(cmd);

            assert.strictEqual(item.label, cmd.label);
            assert.strictEqual(item.description, cmd.description);
            assert.strictEqual(item.command?.command, cmd.id);
            assert.strictEqual(item.command?.title, cmd.label);
            assert.strictEqual(item.contextValue, 'mageforgeCommand');
        });

        test('renders info item without command', () => {
            const { CommandTreeItem } = loadCommandsProvider({
                getMagentoRoot: () => undefined,
                execMageforge: async () => '',
            });

            const item = new CommandTreeItem(undefined, 'Info message');

            assert.strictEqual(item.label, 'Info message');
            assert.strictEqual(item.command, undefined);
            assert.strictEqual(item.contextValue, undefined);
        });
    });
});
