import * as assert from 'assert';
import * as fs from 'node:fs';
import mockRequire = require('mock-require');
import * as os from 'node:os';
import * as path from 'node:path';
import { restoreVscodeMock } from './setup';

type MockConfig = {
    [key: string]: unknown;
};

function createMockVscode(config: MockConfig = {}): typeof import('vscode') {
    return {
        workspace: {
            getConfiguration: (section: string) => ({
                get: <T>(key: string, defaultValue?: T): T => {
                    const fullKey = section ? `${section}.${key}` : key;
                    const value = config[fullKey];
                    return value !== undefined ? (value as T) : (defaultValue as T);
                },
                update: () => Promise.resolve(),
            }),
            workspaceFolders: config['workspace.workspaceFolders'] as
                { uri: { fsPath: string }; name: string; index: number }[] | undefined,
        },
    } as unknown as typeof import('vscode');
}

suite('magento.ts unit tests', () => {
    let sandbox: string;
    let moduleUnderTest: typeof import('../../magento');

    setup(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mageforge-test-'));
    });

    teardown(() => {
        fs.rmSync(sandbox, { recursive: true, force: true });
        // Restore the full vscode mock from setup.ts for other test suites.
        restoreVscodeMock();
    });

    function loadModule(config: MockConfig = {}): typeof import('../../magento') {
        mockRequire('vscode', createMockVscode(config));
        return mockRequire.reRequire('../../magento');
    }

    function createMagentoRoot(): string {
        fs.mkdirSync(path.join(sandbox, 'bin', 'magento'), { recursive: true });
        return sandbox;
    }

    suite('getMagentoRoot', () => {
        test('returns undefined when no workspace is open and no path is configured', () => {
            moduleUnderTest = loadModule({
                'mageforge.magentoRootPath': '',
                'workspace.workspaceFolders': undefined,
            });
            assert.strictEqual(moduleUnderTest.getMagentoRoot(), undefined);
        });

        test('returns configured path when it points to a valid Magento root', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.magentoRootPath': root,
                'workspace.workspaceFolders': undefined,
            });
            assert.strictEqual(moduleUnderTest.getMagentoRoot(), root);
        });

        test('returns undefined when configured path is not a Magento root', () => {
            moduleUnderTest = loadModule({
                'mageforge.magentoRootPath': sandbox,
                'workspace.workspaceFolders': undefined,
            });
            assert.strictEqual(moduleUnderTest.getMagentoRoot(), undefined);
        });

        test('falls back to first workspace folder', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.magentoRootPath': '',
                'workspace.workspaceFolders': [{ uri: { fsPath: root }, name: 'test', index: 0 }],
            });
            assert.strictEqual(moduleUnderTest.getMagentoRoot(), root);
        });
    });

    suite('getExecutionEnvironment', () => {
        test('returns explicit setting when not auto', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'ddev' });
            assert.strictEqual(moduleUnderTest.getExecutionEnvironment(root), 'ddev');
        });

        test('auto-detects ddev', () => {
            const root = createMagentoRoot();
            fs.mkdirSync(path.join(root, '.ddev'));
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'auto' });
            assert.strictEqual(moduleUnderTest.getExecutionEnvironment(root), 'ddev');
        });

        test('auto-detects docker-compose', () => {
            const root = createMagentoRoot();
            fs.writeFileSync(path.join(root, 'docker-compose.yml'), '');
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'auto' });
            assert.strictEqual(moduleUnderTest.getExecutionEnvironment(root), 'docker-compose');
        });

        test('auto-detects lando', () => {
            const root = createMagentoRoot();
            fs.writeFileSync(path.join(root, '.lando.yml'), '');
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'auto' });
            assert.strictEqual(moduleUnderTest.getExecutionEnvironment(root), 'lando');
        });

        test('defaults to local', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'auto' });
            assert.strictEqual(moduleUnderTest.getExecutionEnvironment(root), 'local');
        });
    });

    suite('buildCommandLine', () => {
        test('builds simple local command', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.phpExecution': 'local',
                'mageforge.phpBinary': 'php',
            });
            const line = moduleUnderTest.buildCommandLine(root, 'mageforge:theme:build', [
                'Magento/luma',
            ]);
            assert.strictEqual(line, 'php bin/magento mageforge\\:theme\\:build Magento/luma');
        });

        test('quotes paths with spaces', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.phpExecution': 'local',
                'mageforge.phpBinary': 'php',
            });
            const line = moduleUnderTest.buildCommandLine(root, 'mageforge:template:override', [
                '/path/with spaces/file.phtml',
                '--theme',
                'Magento/luma',
            ]);
            assert.ok(line.includes("'/path/with spaces/file.phtml'"));
            assert.ok(line.includes('Magento/luma'));
        });

        test('prevents shell injection via theme code', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.phpExecution': 'local',
                'mageforge.phpBinary': 'php',
            });
            const line = moduleUnderTest.buildCommandLine(root, 'mageforge:theme:build', [
                'Vendor/theme; rm -rf /',
            ]);
            // The dangerous payload must be wrapped in single quotes so the shell
            // treats it as a single argument instead of executing it.
            assert.ok(line.includes("'Vendor/theme; rm -rf /'"));
            assert.ok(!line.includes('Vendor/theme; rm -rf / '));
        });

        test('handles phpBinary with spaces', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.phpExecution': 'local',
                'mageforge.phpBinary': 'docker-compose exec php',
            });
            const line = moduleUnderTest.buildCommandLine(root, 'mageforge:theme:build', [
                'Magento/luma',
            ]);
            assert.strictEqual(
                line,
                'docker-compose exec php bin/magento mageforge\\:theme\\:build Magento/luma',
            );
        });

        test('builds ddev command', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'ddev' });
            const line = moduleUnderTest.buildCommandLine(root, 'mageforge:theme:list');
            assert.strictEqual(line, 'ddev php bin/magento mageforge\\:theme\\:list');
        });

        test('builds docker-compose command with custom service', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.phpExecution': 'docker-compose',
                'mageforge.dockerComposeService': 'app',
            });
            const line = moduleUnderTest.buildCommandLine(root, 'mageforge:theme:list');
            assert.strictEqual(
                line,
                'docker-compose exec app bin/magento mageforge\\:theme\\:list',
            );
        });

        test('quotes Windows-style paths safely', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({
                'mageforge.phpExecution': 'local',
                'mageforge.phpBinary': 'php',
            });
            const line = moduleUnderTest.buildCommandLine(root, 'mageforge:template:override', [
                'C:\\Users\\test\\file.phtml',
                '--theme',
                'Magento/luma',
            ]);
            assert.ok(line.includes('C:\\Users\\test\\file.phtml'));
            assert.ok(line.includes('Magento/luma'));
        });
    });

    suite('buildComposerUpdateCommand', () => {
        test('builds local composer update command', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'local' });
            const line = moduleUnderTest.buildComposerUpdateCommand(root);
            assert.strictEqual(line, 'composer update openforgeproject/mageforge');
        });

        test('builds ddev composer update command', () => {
            const root = createMagentoRoot();
            moduleUnderTest = loadModule({ 'mageforge.phpExecution': 'ddev' });
            const line = moduleUnderTest.buildComposerUpdateCommand(root, 'vendor/package');
            assert.strictEqual(line, 'ddev composer update vendor/package');
        });
    });
});
