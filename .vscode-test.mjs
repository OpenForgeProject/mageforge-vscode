import { defineConfig } from '@vscode/test-cli';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mageforge-vscode-test-'));
fs.mkdirSync(path.join(workspaceDir, 'app', 'etc'), { recursive: true });
fs.writeFileSync(path.join(workspaceDir, 'app', 'etc', 'env.php'), '<?php return [];');

export default defineConfig({
    files: 'out/test/extension.test.js',
    version: '1.131.0',
    workspaceFolder: workspaceDir,
});
