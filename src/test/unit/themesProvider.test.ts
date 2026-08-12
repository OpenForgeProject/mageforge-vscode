import * as assert from 'assert';
import { parseThemeList } from '../../themesProvider';

suite('themesProvider.ts unit tests', () => {
    suite('parseThemeList', () => {
        test('parses standard mageforge:theme:list output', () => {
            const output = `
                ┌─────────────────┬────────┬──────────────────────────────────────────┐
                │ Code            │ Title  │ Path                                     │
                ├─────────────────┼────────┼──────────────────────────────────────────┤
                │ Magento/blank   │ Blank  │ vendor/magento/theme-frontend-blank      │
                │ Magento/luma    │ Luma   │ vendor/magento/theme-frontend-luma       │
                │ Magento/backend │ Admin  │ adminhtml/Magento/backend                │
                └─────────────────┴────────┴──────────────────────────────────────────┘
            `;

            const themes = parseThemeList(output);

            assert.strictEqual(themes.length, 3);
            assert.deepStrictEqual(themes[0], {
                code: 'Magento/blank',
                title: 'Blank',
                area: 'frontend',
            });
            assert.deepStrictEqual(themes[1], {
                code: 'Magento/luma',
                title: 'Luma',
                area: 'frontend',
            });
            assert.deepStrictEqual(themes[2], {
                code: 'Magento/backend',
                title: 'Admin',
                area: 'adminhtml',
            });
        });

        test('handles ANSI colored output', () => {
            const output =
                '\x1B[32m│ Magento/luma │\x1B[0m \x1B[33mLuma\x1B[0m │ vendor/magento/theme-frontend-luma │';

            const themes = parseThemeList(output);

            assert.strictEqual(themes.length, 1);
            assert.deepStrictEqual(themes[0], {
                code: 'Magento/luma',
                title: 'Luma',
                area: 'frontend',
            });
        });

        test('skips rows without a valid theme code', () => {
            const output = `
                │ Code            │ Title  │ Path                                     │
                │ Magento/luma    │ Luma   │ vendor/magento/theme-frontend-luma       │
            `;

            const themes = parseThemeList(output);

            assert.strictEqual(themes.length, 1);
            assert.strictEqual(themes[0].code, 'Magento/luma');
        });

        test('handles missing title', () => {
            const output = '│ Custom/theme │ │ vendor/magento/theme-frontend-blank │';

            const themes = parseThemeList(output);

            assert.strictEqual(themes.length, 1);
            assert.strictEqual(themes[0].code, 'Custom/theme');
            assert.strictEqual(themes[0].title, undefined);
        });

        test('deduplicates theme codes keeping first occurrence', () => {
            const output = `
                │ Magento/luma │ Luma │ vendor/magento/theme-frontend-luma │
                │ Magento/luma │ Duplicate │ vendor/magento/theme-frontend-luma │
            `;

            const themes = parseThemeList(output);

            assert.strictEqual(themes.length, 1);
            assert.strictEqual(themes[0].title, 'Luma');
        });

        test('handles empty output', () => {
            const themes = parseThemeList('');
            assert.deepStrictEqual(themes, []);
        });
    });
});
