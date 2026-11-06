## Why

`desk wt finish` rejected by a stale remote branch said "rerun with --rebased", but `--force-if-includes` then refuses a fresh worktree made over an old remote branch, with no way out shown (T-135).

## What Changes

- The rejected-push error of `wt finish` (with and without `--rebased`) also names the way out: `git rebase origin/<branch>` or `git push origin --delete <branch>`. The push protection is unchanged.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: "wt finish rejected push" gains a scenario.
