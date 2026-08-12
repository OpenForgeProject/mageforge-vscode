# MageForge VS Code Extension Tests

This directory contains both fast unit tests and VS Code integration tests.

## Test Structure

```
src/test/
├── extension.test.ts          # VS Code integration tests
├── unit/
│   ├── setup.ts               # Mocha setup: mocks the vscode API for unit tests
│   ├── commandsProvider.test.ts
│   ├── magento.test.ts
│   └── themesProvider.test.ts
└── README.md                  # This file
```

## Running Tests

### Unit Tests

Fast tests that run without starting VS Code. They mock the `vscode` API and
validate pure business logic.

```bash
npm run test:unit
```

With coverage:

```bash
npm run test:unit:coverage
```

### Integration Tests

Tests that run inside a real VS Code instance. They validate command
registration, view providers, and extension activation.

```bash
npm test
```

This compiles the extension and tests, then launches VS Code with the test
workspace defined in `.vscode-test.mjs`.

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **Build & Lint** – type check, formatting check, lint, production build
2. **Unit Tests & Coverage** – `npm run test:unit:coverage` on Ubuntu
3. **Integration Tests** – `npm test` on Ubuntu, Windows, and macOS

## Writing New Tests

- Add pure function tests to `src/test/unit/`.
- Add VS Code API dependent tests to `src/test/extension.test.ts`.
- Run `npm run lint` and `npm run format:check` before committing.
