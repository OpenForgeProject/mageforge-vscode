# Copilot Instructions for mageforge-vscode

## Commit Messages

- Use Conventional Commits (e.g. `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Write end-user-friendly commit messages.
- Avoid overly technical or implementation-detail-heavy wording.
- Focus on describing what users gain from the change and the benefit it provides.

## Examples

- Instead of: `refactor: move theme provider to async/await`
  Use: `refactor: load themes faster and more reliably in the background`
- Instead of: `fix: handle null in getThemePath`
  Use: `fix: prevent crashes when no Magento theme is selected`

## Code Quality

- Run the full verification command before committing:
  `npm run format:check && npm run check-types && npm run lint && npm run test:unit:coverage && npm test`
- Prefer the VS Code task `watch` (`Tasks: Run Build Task`) during development.
- Never commit without running at least `npm run format:check && npm run test:unit`.

## Testing

- Add unit tests in `src/test/unit/` for pure business logic and helper functions.
- Use `src/test/unit/setup.ts` for vscode API mocks; reset shared mock state via `mochaHooks` if needed.
- Add VS Code integration tests in `src/test/extension.test.ts` for activation, commands, and views.
- Keep unit tests fast: mock `vscode` and MageForge CLI calls; avoid launching VS Code.
- Validate URLs passed to `vscode.env.openExternal` with `isAllowedExternalUrl()` and add corresponding tests.
- Run `npm run test:unit:coverage` before pushing to ensure coverage stays above 80%.
