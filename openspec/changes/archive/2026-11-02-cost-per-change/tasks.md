## 1. Implementation

- [x] 1.1 `tally` keeps the first `cwd` and the first `type: user` row's text beside its counts; `tokenRows` turns them into `worktree` and drops them, so neither reaches a row
- [x] 1.2 One matcher built from `config()`: the `worktreesDir` folder name (escaped) plus each git repo's `worktreePrefix`, case-insensitive, either separator, anchored so `elsewhere/...` and `<x>wts/...` do not match. Not `worktreeList`
- [x] 1.3 `tokenRows`: main key is first `cwd`, then first user row, then `(desk)`; subagent key is first user row, then the parent's key
- [x] 1.4 `tokens`: `--by-worktree` sums rows per key, largest fresh first, leaves out keys with no calls, prints the existing total line; `--json` is unchanged by the flag
- [x] 1.5 Usage comment at the top of `bin/desk.mjs`

## 2. Tests

- [x] 2.1 In `test/desk.test.mjs`, one fake-home helper (as `desk tokens --json: every row carries its transcript file name`, but with a repo and `worktreesDir` in the config, a `cwd` on rows and a `type: user` line) and a case per scenario of the Tokens delta spec. No worktree folder is created, so each case also holds for a removed worktree
- [x] 2.2 The fake transcripts carry a marker in each brief, and the JSON scenario asserts the marker is absent from stdout

## 3. Docs

- [x] 3.1 README: the `desk tokens` row of the commands table and the Tokens and overlaps section (the key, the `(desk)` row, the window and cleanup limits)
- [x] 3.2 CHANGELOG
- [x] 3.3 `openspec/inventory.md`: a `--by-worktree` row; the `desk tokens` row names any new function

## 4. Check

- [x] 4.1 `npm test && claude plugin test && claude plugin validate .`; `openspec validate cost-per-change --strict`
- [x] 4.2 Run `desk tokens 720 --by-worktree` on this desk and compare with the sample in the proposal
