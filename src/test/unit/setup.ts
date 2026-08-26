import mockRequire = require('mock-require');

interface MockConfig {
    [key: string]: unknown;
}

let lastWebviewPanel: { webview: ReturnType<typeof createMockWebview> } | undefined;
const executedCommands: string[] = [];
const executedArgs: unknown[] = [];
const openedExternals: string[] = [];
const registeredCommandHandlers = new Map<string, (...args: unknown[]) => unknown>();

export function getLastWebviewPanel():
    { webview: ReturnType<typeof createMockWebview> } | undefined {
    return lastWebviewPanel;
}

export function restoreVscodeMock(): void {
    mockRequire('vscode', createMockVscode());
}

export function resetMockState(): void {
    executedCommands.length = 0;
    executedArgs.length = 0;
    openedExternals.length = 0;
    registeredCommandHandlers.clear();
}

export function getRegisteredCommand(id: string): ((...args: unknown[]) => unknown) | undefined {
    return registeredCommandHandlers.get(id);
}

export const mochaHooks = {
    beforeEach(): void {
        resetMockState();
    },
};

export type CapturedMessage = {
    url?: string;
    command?: string;
    type?: string;
    mageforge?: string;
    latest?: string;
    outdated?: boolean;
    isDev?: boolean;
};

export function createMockWebview(): {
    asWebviewUri: (uri: { fsPath: string }) => { toString: () => string };
    html: string;
    cspSource: string;
    messages: CapturedMessage[];
    postMessage: (message: CapturedMessage) => boolean;
    onDidReceiveMessageHandler: ((message: CapturedMessage) => void) | undefined;
    onDidReceiveMessage: (handler: (message: CapturedMessage) => void) => void;
} {
    const messages: CapturedMessage[] = [];
    return {
        asWebviewUri: (uri: { fsPath: string }) => ({
            toString: () => `vscode-webview://mageforge/${uri.fsPath}`,
        }),
        html: '',
        cspSource: 'vscode-webview://mageforge',
        messages,
        postMessage: (message: CapturedMessage) => {
            messages.push(message);
            return true;
        },
        onDidReceiveMessageHandler: undefined,
        onDidReceiveMessage: function (handler: (message: CapturedMessage) => void) {
            this.onDidReceiveMessageHandler = handler;
        },
    };
}

export function createMockWebviewView(): {
    visible: boolean;
    webview: ReturnType<typeof createMockWebview>;
    onDidChangeVisibilityHandler: (() => void) | undefined;
    onDidChangeVisibility: (handler: () => void) => void;
} {
    return {
        visible: true,
        webview: createMockWebview(),
        onDidChangeVisibilityHandler: undefined,
        onDidChangeVisibility: function (handler: () => void) {
            this.onDidChangeVisibilityHandler = handler;
        },
    };
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
            onDidChangeConfiguration: () => ({ dispose: () => undefined }),
            openTextDocument: () => Promise.resolve({}),
        },
        window: {
            createTerminal: () => ({
                show: () => undefined,
                sendText: () => undefined,
            }),
            createWebviewPanel: () => {
                const webview = createMockWebview();
                lastWebviewPanel = { webview };
                return {
                    webview,
                    title: '',
                    reveal: () => undefined,
                    onDidDispose: () => undefined,
                    dispose: () => undefined,
                };
            },
            registerWebviewViewProvider: () => ({ dispose: () => undefined }),
            registerTreeDataProvider: () => ({ dispose: () => undefined }),
            createTreeView: () => ({ dispose: () => undefined }),
            terminals: [],
            showErrorMessage: () => Promise.resolve(undefined),
            showInformationMessage: () => Promise.resolve(undefined),
            showQuickPick: () => Promise.resolve(undefined),
            activeTextEditor: config['window.activeTextEditor'] as
                { document: { uri: { fsPath: string } } } | undefined,
        },
        commands: {
            registerCommand: (command: string, handler: (...args: unknown[]) => unknown) => {
                registeredCommandHandlers.set(command, handler);
                return { dispose: () => registeredCommandHandlers.delete(command) };
            },
            executeCommand: (command: string, ...args: unknown[]) => {
                executedCommands.push(command);
                executedArgs.push(args);
                return Promise.resolve();
            },
            get executedCommands() {
                return executedCommands;
            },
            get executedArgs() {
                return executedArgs;
            },
        },
        ConfigurationTarget: {
            Global: 1,
            Workspace: 2,
            WorkspaceFolder: 3,
        },
        env: {
            openExternal: (uri: { toString: () => string }) => {
                openedExternals.push(uri.toString());
                return Promise.resolve(true);
            },
            get openedExternals() {
                return openedExternals;
            },
        },
        ViewColumn: {
            One: 1,
            Two: 2,
            Three: 3,
        },
        ThemeIcon: class ThemeIcon {
            constructor(public readonly id: string) {}
        },
        ThemeColor: class ThemeColor {
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
        EventEmitter: class EventEmitter<T> {
            private listeners: Array<(event: T) => void> = [];
            event = (listener: (event: T) => void) => {
                this.listeners.push(listener);
                return { dispose: () => undefined };
            };
            fire = (event: T) => {
                this.listeners.forEach((listener) => listener(event));
            };
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
            file: (path: string) => ({ fsPath: path, toString: () => path }),
            parse: (path: string) => ({ fsPath: path, toString: () => path }),
            joinPath: (...parts: (string | { fsPath: string })[]) => ({
                fsPath: parts.map((p) => (typeof p === 'string' ? p : p.fsPath)).join('/'),
            }),
        },
    } as unknown as typeof import('vscode');
}

mockRequire('vscode', createMockVscode());
