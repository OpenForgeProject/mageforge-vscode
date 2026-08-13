import * as assert from 'assert';
import mockRequire = require('mock-require');
import { createMockWebview, createMockWebviewView } from './setup';

type MockMagento = {
    getMagentoRoot: () => string | undefined;
    execMageforge: (root: string, command: string) => Promise<string>;
};

function loadThemesProvider(magentoMock: MockMagento) {
    mockRequire('../../magento', magentoMock);
    return mockRequire.reRequire('../../themesProvider') as typeof import('../../themesProvider');
}

suite('ThemesProvider class unit tests', () => {
    teardown(() => {
        mockRequire.stop('../../magento');
    });

    test('loads themes on first getChildren call', async () => {
        const { ThemesProvider } = loadThemesProvider({
            getMagentoRoot: () => '/magento',
            execMageforge: async () =>
                '│ Magento/luma │ Luma │ vendor/magento/theme-frontend-luma │',
        });

        const provider = new ThemesProvider();
        const children = await provider.getChildren();

        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].theme?.code, 'Magento/luma');
    });

    test('returns cached themes without calling execMageforge again', async () => {
        let calls = 0;
        const { ThemesProvider } = loadThemesProvider({
            getMagentoRoot: () => '/magento',
            execMageforge: async () => {
                calls++;
                return '│ Magento/luma │ Luma │ vendor/magento/theme-frontend-luma │';
            },
        });

        const provider = new ThemesProvider();
        await provider.getChildren();
        await provider.getThemeCodes();
        await provider.getChildren();

        assert.strictEqual(calls, 1);
        assert.deepStrictEqual(await provider.getThemeCodes(), ['Magento/luma']);
    });

    test('handles loading error and allows retry after refresh', async () => {
        let shouldFail = true;
        const { ThemesProvider } = loadThemesProvider({
            getMagentoRoot: () => '/magento',
            execMageforge: async () => {
                if (shouldFail) {
                    throw new Error('Command failed');
                }
                return '│ Magento/luma │ Luma │ vendor/magento/theme-frontend-luma │';
            },
        });

        const provider = new ThemesProvider();
        const children = await provider.getChildren();

        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].theme, undefined);
        assert.ok(children[0].label?.toString().includes('Could not load'));

        shouldFail = false;
        provider.refresh();
        const retried = await provider.getChildren();

        assert.strictEqual(retried.length, 1);
        assert.strictEqual(retried[0].theme?.code, 'Magento/luma');
    });

    test('shows error when no Magento root is found', async () => {
        const { ThemesProvider } = loadThemesProvider({
            getMagentoRoot: () => undefined,
            execMageforge: async () => '',
        });

        const provider = new ThemesProvider();
        const children = await provider.getChildren();

        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].theme, undefined);
        assert.ok(children[0].label?.toString().includes('Could not load'));
    });

    test('returns empty array for child elements', async () => {
        const { ThemesProvider, ThemeTreeItem } = loadThemesProvider({
            getMagentoRoot: () => '/magento',
            execMageforge: async () =>
                '│ Magento/luma │ Luma │ vendor/magento/theme-frontend-luma │',
        });

        const provider = new ThemesProvider();
        const theme = new ThemeTreeItem({ code: 'Magento/luma' });
        const children = await provider.getChildren(theme);

        assert.deepStrictEqual(children, []);
    });

    test('tree item uses correct icon for adminhtml themes', async () => {
        const { ThemesProvider } = loadThemesProvider({
            getMagentoRoot: () => '/magento',
            execMageforge: async () => '│ Magento/backend │ Admin │ adminhtml/Magento/backend │',
        });

        const provider = new ThemesProvider();
        const children = await provider.getChildren();

        assert.strictEqual(children[0].theme?.area, 'adminhtml');
        assert.strictEqual((children[0].iconPath as { id: string }).id, 'shield');
    });

    test('race condition: parallel calls share a single load', async () => {
        let calls = 0;
        const { ThemesProvider } = loadThemesProvider({
            getMagentoRoot: () => '/magento',
            execMageforge: async () => {
                calls++;
                // Simulate slow load
                await new Promise((resolve) => setTimeout(resolve, 10));
                return '│ Magento/luma │ Luma │ vendor/magento/theme-frontend-luma │';
            },
        });

        const provider = new ThemesProvider();
        const [a, b] = await Promise.all([provider.getChildren(), provider.getThemeCodes()]);

        assert.strictEqual(calls, 1);
        assert.strictEqual(a.length, 1);
        assert.deepStrictEqual(b, ['Magento/luma']);
    });

    test('refresh during load discards stale result', async () => {
        let firstCall = true;
        let firstResolve!: (value: string) => void;
        const firstPromise = new Promise<string>((resolve) => {
            firstResolve = resolve;
        });
        const { ThemesProvider } = loadThemesProvider({
            getMagentoRoot: () => '/magento',
            execMageforge: async () => {
                if (firstCall) {
                    firstCall = false;
                    return firstPromise;
                }
                return '│ Magento/blank │ Blank │ vendor/magento/theme-frontend-blank │';
            },
        });

        const provider = new ThemesProvider();
        const loadPromise = provider.getChildren();
        provider.refresh();
        firstResolve('│ Magento/luma │ Luma │ vendor/magento/theme-frontend-luma │');
        await loadPromise;

        const children = await provider.getChildren();

        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].theme?.code, 'Magento/blank');
    });
});
