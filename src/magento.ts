import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as shellQuote from 'shell-quote';

/**
 * Resolve the Magento root directory (contains bin/magento).
 * Falls back to the first workspace folder.
 */
export function getMagentoRoot(): string | undefined {
    const configured = vscode.workspace
        .getConfiguration('mageforge')
        .get<string>('magentoRootPath');
    const candidate = configured?.trim() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!candidate) {
        return undefined;
    }

    // Validate that the resolved directory looks like a Magento root.
    if (!fs.existsSync(path.join(candidate, 'bin', 'magento'))) {
        return undefined;
    }

    return candidate;
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
 * All arguments are safely quoted to prevent shell injection.
 * The MageForge command name itself is not quoted because it is always a
 * known, hard-coded CLI identifier (e.g. `mageforge:theme:build`); escaping
 * its colons makes the generated command hard to read and can confuse
 * containerized PHP wrappers.
 */
export function buildCommandLine(
    magentoRoot: string,
    mageforgeCommand: string,
    args: string[] = [],
): string {
    const phpBinary = vscode.workspace
        .getConfiguration('mageforge')
        .get<string>('phpBinary', 'php');
    const env = getExecutionEnvironment(magentoRoot);

    const quote = (parts: string[]): string => shellQuote.quote(parts);

    function buildLine(baseParts: string[]): string {
        const base = quote(baseParts);
        const quotedArgs = args.length > 0 ? ` ${quote(args)}` : '';
        return `${base} ${mageforgeCommand}${quotedArgs}`;
    }

    switch (env) {
        case 'ddev':
            return buildLine(['ddev', 'php', 'bin/magento']);
        case 'docker-compose': {
            const service = getDockerComposeService();
            return buildLine(['docker-compose', 'exec', service, 'bin/magento']);
        }
        case 'lando':
            return buildLine(['lando', 'php', 'bin/magento']);
        default: {
            // phpBinary can be a full command like "docker-compose exec php" or just "php"
            const phpParts = shellQuote.parse(phpBinary) as string[];
            return buildLine([...phpParts, 'bin/magento']);
        }
    }
}

/**
 * Build a shell command line that updates a Composer package.
 * Respects the configured PHP execution environment.
 */
export function buildComposerUpdateCommand(
    magentoRoot: string,
    packageName: string = 'openforgeproject/mageforge',
): string {
    const env = getExecutionEnvironment(magentoRoot);

    switch (env) {
        case 'ddev':
            return shellQuote.quote(['ddev', 'composer', 'update', packageName]);
        case 'docker-compose': {
            const service = getDockerComposeService();
            return shellQuote.quote([
                'docker-compose',
                'exec',
                service,
                'composer',
                'update',
                packageName,
            ]);
        }
        case 'lando':
            return shellQuote.quote(['lando', 'composer', 'update', packageName]);
        default:
            return shellQuote.quote(['composer', 'update', packageName]);
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
            default: {
                // phpBinary may be a full command like "docker-compose exec php"
                const parts = shellQuote.parse(phpBinary) as string[];
                file = parts[0];
                finalArgs = [...parts.slice(1), ...baseArgs];
                break;
            }
        }

        execFile(
            file,
            finalArgs,
            { cwd: magentoRoot, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message || 'Command failed'));
                    return;
                }
                resolve(stdout);
            },
        );
    });
}
