## Why

`desk wt discard <slug>` left a todo started with `--slug <slug>` active with `wt:<slug>`, pointing at a removed worktree (v0.8.0 smoke, T-278). `wt merge` closes such todos; discard released nothing.

## What Changes

- `wt discard` returns the slug's active todos to `open`, clears their `slug` and `owner`, keeps their notes, adds the note `worktree <slug> discarded`, and prints `reopened: T-n, ...`.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: wt discard.
