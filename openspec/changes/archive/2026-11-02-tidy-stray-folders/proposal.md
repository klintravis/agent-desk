## Why

A failed `git worktree remove` (common on Windows) leaves a folder in the worktrees folder that git no longer knows. Nothing reports it, and it may hold someone's files.

## What Changes

- `desk tidy` lists stray folders: directories in the worktrees folder named like a configured git repo's `worktreePrefix` + valid slug that no configured repo's `git worktree list` names. Report only: `--apply` never deletes or touches them.
- A repo whose `git worktree list` fails makes its own folders unknown, listed as kept with the reason, never strays. Folders outside every prefix are ignored.
- The JSON report gains the key `strayFolders`.

## Capabilities

### Modified Capabilities
- `desk-tidy`: Stray worktree folders.
