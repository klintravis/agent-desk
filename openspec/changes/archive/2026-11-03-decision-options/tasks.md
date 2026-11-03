## 1. Implementation

- [x] 1.1 `options` in `schemas/todo.schema.json` and `schemas/desk-status.schema.json`, `v` unchanged
- [x] 1.2 `--option` collected by `flags()` with its limits; other flags still overwrite on a repeat
- [x] 1.3 `decisionOf` as the one reading of a decision, `desk decide --json`, the printed format, old `--why` todos
- [x] 1.4 `decisions[].options` in `desk status --json`
- [x] 1.5 `lib/tidy.mjs` raises its question with options
- [x] 1.6 `hooks/pane.tsx` reads the JSON, whys in the question text; tests in `hooks/pane.test.tsx`
- [x] 1.7 `vscode/desk.js` and `vscode/extension.js`: JSON, quick pick with detail, free text; tests in `test/vscode.test.mjs`
- [x] 1.8 Agent instructions: skills, `lib/wt.mjs`, `templates/AGENTS.md`
- [x] 1.9 README, `vscode/README.md`, inventory, CHANGELOG
