## Why

`desk tidy` listed the worktrees folder with `lstat`, so a `worktreesDir` that is a symlink or junction read as empty and no stray was ever reported (T-132).

## What Changes

- Tidy follows a linked worktrees folder when listing strays. Strays are only reported, never deleted, so following the link adds no deletion; no other folder tidy lists follows a link.

## Capabilities

### Modified Capabilities
- `desk-tidy`: "Stray worktree folders".
