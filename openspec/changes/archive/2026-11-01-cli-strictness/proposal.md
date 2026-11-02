## Why

`desk home` exits 0 for a stale `DESK_HOME` (T-32), `wt` and `stream` swallow typo flags and a trailing value flag (T-33), a rejected push says only "git push failed" (T-37), and a merge whose worktree folder cannot be removed leaves the branch and claim behind (T-38). T-15 drops a dead `--all` check.

## What Changes

- `desk home` requires `desk.config.json` in the folder it finds.
- `wt` and `stream` each take only their own flags and exit 1 on any other flag or a value flag without a value.
- `wt finish` says to rerun with `--rebased` when git rejects the push as non-fast-forward.
- `wt merge` shows git's reason when the worktree remove fails. It still closes (release posted, branch deleted when possible) with a warning when git unregistered the worktree but the folder stayed; when git refused (modified or untracked files, a lock) it keeps the worktree and the claim and exits 1.

## Capabilities

### Modified Capabilities
- `desk-cli`: requirement `desk home`.
- `worktrees-and-streams`: new requirements for strict flags, a rejected push and an unremovable worktree.

## Impact

`bin/desk.mjs`, `lib/wt.mjs`, README, CHANGELOG (inventory checked: no new command, flag or variable). Breaking only for scripts that passed a flag `wt`/`stream` ignored.
