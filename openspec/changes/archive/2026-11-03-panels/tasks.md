## 1. Implementation

- [x] 1.1 `todos` in `desk status --json`, `schemas/desk-status.schema.json` and `types/index.d.ts`, `v` unchanged, printed screen unchanged
- [x] 1.2 `vscode/desk.js`: `parseStatus` refuses a status with no `todos`; `statusTree` returns decisions, work and todos
- [x] 1.3 `vscode/extension.js` and `vscode/package.json`: one tree view per panel, badge on Decisions
- [x] 1.4 `hooks/pane.tsx`: tabs Decisions, Work and Todos; Tokens and Roots in the rows; nothing shown twice
- [x] 1.5 Tests in `hooks/pane.test.tsx`, `test/vscode.test.mjs` and `test/desk.test.mjs`
- [x] 1.6 README, `vscode/README.md`, inventory, CHANGELOG
