# MageForge for VS Code

![MageForge Hero](./.github/assets/MageForge-Header.png)

The official VS Code integration for [MageForge](https://github.com/OpenForgeProject/mageforge).

## Features

MageForge adds a dedicated **MageForge** activity bar to VS Code that surfaces the most common [MageForge CLI](https://github.com/OpenForgeProject/mageforge) commands without leaving the editor.

- **Welcome view** – quick access to commands and helpful resources.
- **Commands view** – run MageForge CLI commands with a single click:
    - Theme: Build, Watch, Clean, List, Inspector
    - Hyvä: Tokens, Compatibility Check
    - Template: Override
    - Dependencies: Update
    - System: Check, Version
- **Themes view** – browse installed Magento themes (frontend/adminhtml), build, watch, or clean a theme via the context menu, and refresh the list.
- **Template override** – right-click any template file in the Explorer and choose **MageForge > Override File…** to copy it into a selected theme.
- **Integrated terminal output** – commands run in named VS Code terminals inside your Magento root directory.
- **DDEV aware** – automatically runs `bin/magento` through DDEV when a `.ddev` directory is detected, or force it via settings.

## Requirements

- VS Code `^1.125.0`
- A Magento 2 workspace with [MageForge](https://github.com/OpenForgeProject/mageforge) installed
- PHP available on your system (or via DDEV)

## Configuration

The extension contributes the following settings under the `mageforge.` prefix:

| Setting                          | Default  | Description                                                                                    |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `mageforge.magentoRootPath`      | `""`     | Path to the Magento root directory (contains `bin/magento`). Defaults to the workspace folder. |
| `mageforge.phpExecution`         | `"auto"` | How to execute PHP commands: `auto`, `ddev`, `docker-compose`, `lando`, or `local`.            |
| `mageforge.dockerComposeService` | `"php"`  | Docker Compose service name for PHP commands.                                                  |
| `mageforge.phpBinary`            | `"php"`  | PHP binary for local execution. Can be a full command for custom setups.                       |

## Development

### Prerequisites

- Node.js `24+` (see [.nvmrc](./.nvmrc); run `nvm use` if you use nvm)
- VS Code `^1.125.0`

### Setup

```bash
npm install
```

This also activates the pre-commit hook via [husky](https://typicode.github.io/husky/) (see [Code quality](#code-quality)).

### Build & watch

```bash
npm run compile   # type-check + lint + bundle (one-off)
npm run watch     # incremental rebuilds in watch mode
```

### Debugging

Press `F5` (or run the **Run Extension** launch configuration) to open a new Extension Development Host window with the extension loaded. Breakpoints in `src/` work out of the box.

### Testing

```bash
npm test          # runs extension tests in a headless VS Code instance
npm run pretest   # what CI runs before tests: compile tests, compile extension, lint
```

Tests live in [src/test/](./src/test/) and run via [`@vscode/test-electron`](https://github.com/microsoft/vscode-test) — they execute against the real VS Code API, so you can assert on commands, editors, workspace state, etc.

### Code quality

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run check-types`  | TypeScript type checking (`tsc --noEmit`) |
| `npm run lint`         | ESLint on `src/`                          |
| `npm run format`       | Format all files with Prettier            |
| `npm run format:check` | Verify formatting without writing         |

On every commit, [lint-staged](https://github.com/lint-staged/lint-staged) automatically runs Prettier and `eslint --fix` on staged files only. If a check fails, the commit is blocked. To bypass in exceptional cases: `git commit --no-verify` (CI will still catch it).

### CI

Every push and PR runs the [CI workflow](./.github/workflows/ci.yml):

1. **Build & Lint** (Ubuntu): type check, Prettier check, ESLint, production build
2. **Test** (Ubuntu, Windows, macOS): extension tests in headless VS Code

Releases are automated via [release-please](./.github/workflows/release-please.yml) using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, ...).

## Release Notes

See [CHANGELOG.md](./CHANGELOG.md).
