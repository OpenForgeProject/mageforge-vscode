import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * Resolve the Magento root directory (contains bin/magento).
 * Falls back to the first workspace folder.
 */
export function getMagentoRoot(): string | undefined {
    const configured = vscode.workspace
        .getConfiguration('mageforge')
        .get<string>('magentoRootPath');
    if (configured && configured.trim().length > 0) {
        return configured;
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Whether commands should run inside DDEV.
 * Auto-detected via a .ddev directory, can be forced on/off via setting.
 */
export function useDdev(magentoRoot: string): boolean {
    const setting = vscode.workspace.getConfiguration('mageforge').get<string>('useDdev', 'auto');
    if (setting === 'always') {
        return true;
    }
    if (setting === 'never') {
        return false;
    }
    return fs.existsSync(path.join(magentoRoot, '.ddev'));
}

/**
 * Build the shell command line that runs a MageForge CLI command.
 */
export function buildCommandLine(
    magentoRoot: string,
    mageforgeCommand: string,
    args: string[] = [],
): string {
    const phpBinary = vscode.workspace
        .getConfiguration('mageforge')
        .get<string>('phpBinary', 'php');
    const command = ['bin/magento', mageforgeCommand, ...args].join(' ');

    if (useDdev(magentoRoot)) {
        return `ddev php ${command}`;
    }
    return `${phpBinary} ${command}`;
}

/**
 * Run a MageForge CLI command in a dedicated terminal.
 * Reuses an existing terminal with the same name so the command is not
 * executed multiple times across several newly created terminals.
 */
export function runInTerminal(name: string, commandLine: string, cwd: string): void {
    const existing = vscode.window.terminals.find((t) => t.name === name);
    const terminal = existing ?? vscode.window.createTerminal({ name, cwd });
    terminal.show();
    terminal.sendText(commandLine);
}

/**
 * Run a MageForge CLI command silently and capture stdout.
 */
export function execMageforge(
    magentoRoot: string,
    mageforgeCommand: string,
    args: string[] = [],
): Promise<string> {
    const { execFile } = require('node:child_process') as typeof import('node:child_process');
    const phpBinary = vscode.workspace
        .getConfiguration('mageforge')
        .get<string>('phpBinary', 'php');
    const ddev = useDdev(magentoRoot);

    const baseArgs = ['bin/magento', mageforgeCommand, ...args];

    return new Promise((resolve, reject) => {
        const file = ddev ? 'ddev' : phpBinary;
        const finalArgs = ddev ? ['php', ...baseArgs] : baseArgs;

        execFile(
            file,
            finalArgs,
            { cwd: magentoRoot, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                    return;
                }
                resolve(stdout);
            },
        );
    });
}
