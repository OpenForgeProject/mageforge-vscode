import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration Test Suite', () => {
    test('extension is activated', async () => {
        const extension = vscode.extensions.getExtension('OpenForgeProject.mageforge');
        assert.ok(extension, 'MageForge extension should be installed');

        await extension.activate();
        assert.strictEqual(extension.isActive, true, 'MageForge extension should be active');
    });

    test('registered commands exist', async () => {
        const extension = vscode.extensions.getExtension('OpenForgeProject.mageforge');
        assert.ok(extension);
        await extension.activate();

        const commands = await vscode.commands.getCommands(true);
        const mageforgeCommands = commands.filter((cmd) => cmd.startsWith('mageforge.'));

        assert.ok(mageforgeCommands.includes('mageforge.theme.build'));
        assert.ok(mageforgeCommands.includes('mageforge.theme.watch'));
        assert.ok(mageforgeCommands.includes('mageforge.refreshThemes'));
        assert.ok(mageforgeCommands.includes('mageforge.showChangelog'));
        assert.ok(mageforgeCommands.includes('mageforge.updateMageforge'));
    });

    test('mageforge views are registered', async () => {
        await vscode.commands.executeCommand('mageforge.welcome.focus');
        // If the command does not throw, the view provider is registered.
        assert.ok(true);
    });
});
