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

type ExecutionEnvironment = 'ddev' | 'docker-compose' | 'lando' | 'local';

/**
 * Detect the execution environment for PHP commands.
 * Uses explicit `phpExecution` setting or auto-detects from project files.
 */
export function getExecutionEnvironment(magentoRoot: string): ExecutionEnvironment {
    const config = vscode.workspace.getConfiguration('mageforge');
    const execution = config.get<string>('phpExecution', 'auto');

    // Explicit setting takes precedence
    if (execution !== 'auto') {
        return execution as ExecutionEnvironment;
    }

    // Auto-detect
    if (fs.existsSync(path.join(magentoRoot, '.ddev'))) {
        return 'ddev';
    }
    if (
        fs.existsSync(path.join(magentoRoot, 'docker-compose.yml')) ||
        fs.existsSync(path.join(magentoRoot, 'docker-compose.yaml'))
    ) {
        return 'docker-compose';
    }
    if (fs.existsSync(path.join(magentoRoot, '.lando.yml'))) {
        return 'lando';
    }
    return 'local';
}

/**
 * Get the Docker Compose service name for PHP commands.
 */
export function getDockerComposeService(): string {
    return vscode.workspace
        .getConfiguration('mageforge')
        .get<string>('dockerComposeService', 'php');
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
    const env = getExecutionEnvironment(magentoRoot);

    switch (env) {
        case 'ddev':
            return `ddev php ${command}`;
        case 'docker-compose': {
            const service = getDockerComposeService();
            return `docker-compose exec ${service} ${command}`;
        }
        case 'lando':
            return `lando php ${command}`;
        default:
            // phpBinary can be a full command like "docker-compose exec php" or just "php"
            return `${phpBinary} ${command}`;
    }
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

    const baseArgs = ['bin/magento', mageforgeCommand, ...args];

    return new Promise((resolve, reject) => {
        const env = getExecutionEnvironment(magentoRoot);
        let file: string;
        let finalArgs: string[];

        switch (env) {
            case 'ddev':
                file = 'ddev';
                finalArgs = ['php', ...baseArgs];
                break;
            case 'docker-compose': {
                const service = getDockerComposeService();
                file = 'docker-compose';
                finalArgs = ['exec', service, ...baseArgs];
                break;
            }
            case 'lando':
                file = 'lando';
                finalArgs = ['php', ...baseArgs];
                break;
            default:
                // phpBinary may be a full command like "docker-compose exec php"
                const parts = phpBinary.split(/\s+/);
                file = parts[0];
                finalArgs = [...parts.slice(1), ...baseArgs];
        }

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
