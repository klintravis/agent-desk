## 1. CLI

- [x] 1.1 `desk status --cached` in `bin/desk.mjs`: every plain run keeps `gh`'s answers in `<scratchDir>/status-gh.json`; `--cached` reuses them and asks only when none is kept
- [x] 1.2 Test in `test/merge-policy.test.mjs`: counts `gh` calls in each mode, a local change shows, a torn keeper asks

## 2. Pane

- [x] 2.1 `hooks/pane.tsx`: one run at a time, full wins over cached, a 2 s look at the three files, a ruling refreshes with `--cached`
- [x] 2.2 Tests in `hooks/pane.test.tsx`

## 3. Extension

- [x] 3.1 `vscode/extension.js`: a watcher on the three files, debounced, re-made when the desk changes, disposed at the end
- [x] 3.2 Tests in `test/vscode.test.mjs`

## 4. Docs

- [x] 4.1 Refresh prose in `README.md` and `vscode/README.md`, the usage line in `bin/desk.mjs`
