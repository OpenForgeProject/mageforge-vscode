import * as assert from 'node:assert';
import { isAllowedExternalUrl } from '../../url';

suite('url.ts unit tests', () => {
    test('isAllowedExternalUrl accepts https URLs', () => {
        assert.strictEqual(isAllowedExternalUrl('https://example.com'), true);
        assert.strictEqual(
            isAllowedExternalUrl('https://github.com/OpenForgeProject/mageforge'),
            true,
        );
    });

    test('isAllowedExternalUrl accepts http URLs', () => {
        assert.strictEqual(isAllowedExternalUrl('http://example.com'), true);
    });

    test('isAllowedExternalUrl rejects non-http protocols', () => {
        assert.strictEqual(isAllowedExternalUrl('file:///etc/passwd'), false);
        assert.strictEqual(isAllowedExternalUrl('javascript:alert(1)'), false);
        assert.strictEqual(isAllowedExternalUrl('vscode://file/etc/passwd'), false);
        assert.strictEqual(isAllowedExternalUrl('data:text/html,<script>alert(1)</script>'), false);
    });

    test('isAllowedExternalUrl rejects malformed URLs', () => {
        assert.strictEqual(isAllowedExternalUrl(''), false);
        assert.strictEqual(isAllowedExternalUrl('not a url'), false);
        assert.strictEqual(isAllowedExternalUrl('/local/path'), false);
    });
});
