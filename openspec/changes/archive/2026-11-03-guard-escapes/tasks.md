## 1. Implementation

- [x] 1.1 Decode `$'...'` in `scan`, and let `mentions` pass a backslash after `$'`
- [x] 1.2 Drop PowerShell assignment targets in `scan`, and remove the `=` skip from `parse`
- [x] 1.3 `ESCAPE_CASES` and `ASSIGN_CASES` in the table, named tests in `test/merge-guard.test.mjs`
- [x] 1.4 README "not covered" list, CHANGELOG
- [x] 1.5 Refuse a line the parser cannot read that names push or merge, with `UNREADABLE_CASES` and a test through the script
