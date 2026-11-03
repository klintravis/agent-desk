## Why

A fresh worktree lacks gitignored, machine-local files the main checkout has (for agent-desk: `.claude-plugin/types/`, so `npm run typecheck` fails until they are copied by hand) (T-119).

## What Changes

- New optional repo config key `copy`: paths (relative to the repo) that `wt new` copies from the repo's main checkout into the worktree, before `install` and `build`, so `--no-build` still gets them.
- A path missing in the main checkout is skipped; an absolute path or one containing `..` is refused.
- Setting `copy` in the desk's own repo config (and placing the types file in the main checkout) is a follow-up todo outside this change.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: `wt new` setup.
