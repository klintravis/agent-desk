## 1. Extension

- [x] 1.1 `vscode/package.json`: id, version, Workspace Trust, activity-bar view, commands, no dependencies
- [x] 1.2 `vscode/desk.js`: find the desk, run the CLI, status JSON to tree, parse `desk decide`, secret check before recording
- [x] 1.3 `vscode/extension.js`: view, badge, refresh, Decide walk
- [x] 1.4 `vscode/README.md`, `vscode/LICENSE`, `vscode/icon.svg`; `*.vsix` in `.gitignore`

## 2. Tests and docs

- [x] 2.1 `test/vscode.test.mjs`: parsing against the real CLI, activation and the Decide walk against a stubbed `vscode`, manifest, package `files`
- [x] 2.2 README section and Copilot feature table
- [x] 2.3 CHANGELOG, `openspec/inventory.md` rows (scribe, after this)
- [x] 2.4 `scripts/release.mjs`: `vscode/package.json` is a version file; `test/release.test.mjs` covers it
