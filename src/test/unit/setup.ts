import mockRequire = require('mock-require');

interface MockConfig {
    [key: string]: unknown;
}

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
        window: {
            createTerminal: () => ({
                show: () => undefined,
                sendText: () => undefined,
            }),
            terminals: [],
        },
        ThemeIcon: class ThemeIcon {
            constructor(public readonly id: string) {}
        },
        TreeItem: class TreeItem {
            constructor(
                public readonly label: string,
                public readonly collapsibleState: number,
            ) {}
        },
        TreeItemCollapsibleState: {
            None: 0,
            Collapsed: 1,
            Expanded: 2,
        },
        MarkdownString: class MarkdownString {
            public value: string;
            constructor(value: string) {
                this.value = value;
            }
            appendText(text: string): typeof this {
                this.value += text;
                return this;
            }
            appendMarkdown(text: string): typeof this {
                this.value += text;
                return this;
            }
        },
        Uri: {
            file: (path: string) => ({ fsPath: path }),
            joinPath: (...parts: (string | { fsPath: string })[]) => ({
                fsPath: parts.map((p) => (typeof p === 'string' ? p : p.fsPath)).join('/'),
            }),
        },
    } as unknown as typeof import('vscode');
}

mockRequire('vscode', createMockVscode());
