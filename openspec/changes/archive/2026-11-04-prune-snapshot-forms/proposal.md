## Why

The prune keeps snapshots of state that has moved on, but only as Bash commands spelled `git status`. Desks on Windows run them through PowerShell, and worktree agents write `git -C <path> status`, so those results were cut (T-207).

## What Changes

- `git -C <path> status` and `git -C <path> stash list` count as snapshots, with a quoted or unquoted path.
- A snapshot command run through the `PowerShell` tool stays whole, as it does through `Bash`.

## Capabilities

### Modified Capabilities
- `compaction-prune`: "What stays".
