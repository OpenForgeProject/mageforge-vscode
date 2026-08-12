import * as assert from 'assert';
import { CommandTreeItem, CommandsProvider, MAGEFORGE_COMMANDS } from '../../commandsProvider';

suite('commandsProvider.ts unit tests', () => {
    suite('MAGEFORGE_COMMANDS', () => {
        test('contains expected commands', () => {
            const ids = MAGEFORGE_COMMANDS.map((cmd) => cmd.id);
            assert.ok(ids.includes('mageforge.theme.build'));
            assert.ok(ids.includes('mageforge.theme.watch'));
            assert.ok(ids.includes('mageforge.theme.clean'));
            assert.ok(ids.includes('mageforge.system.version'));
        });

        test('theme commands accept themes', () => {
            const themeCommands = MAGEFORGE_COMMANDS.filter((cmd) => cmd.acceptsThemes);
            const ids = themeCommands.map((cmd) => cmd.id);
            assert.deepStrictEqual(ids.sort(), ['mageforge.theme.build', 'mageforge.theme.watch']);
        });

        test('watch command is marked as watch', () => {
            const watch = MAGEFORGE_COMMANDS.find((cmd) => cmd.id === 'mageforge.theme.watch');
            assert.strictEqual(watch?.isWatch, true);
        });
    });

    suite('CommandsProvider', () => {
        test('returns all commands as tree items', () => {
            const provider = new CommandsProvider();
            const children = provider.getChildren();

            assert.strictEqual(children.length, MAGEFORGE_COMMANDS.length);
        });
    });

    suite('CommandTreeItem', () => {
        test('sets label, description and command', () => {
            const cmd = MAGEFORGE_COMMANDS[0];
            const item = new CommandTreeItem(cmd);

            assert.strictEqual(item.label, cmd.label);
            assert.strictEqual(item.description, cmd.description);
            assert.strictEqual(item.command?.command, cmd.id);
            assert.strictEqual(item.command?.title, cmd.label);
            assert.strictEqual(item.contextValue, 'mageforgeCommand');
        });
    });
});
