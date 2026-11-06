## 1. Implementation

- [x] 1.1 CASES rows for switches and file checkouts, seen failing against the parser at the branch's base
- [x] 1.2 `switchTarget` and `switched` in `parse`, `judge` reads them through `onCurrent`
- [x] 1.3 `loadConfig` strips a leading BOM
- [x] 1.4 `test/merge-guard.test.mjs`: the real script honours a switch, and a BOM config still refuses

## 2. Docs

- [x] 2.1 Not-covered lists in `hooks/mergeguard.mjs` and the README, CHANGELOG entry
