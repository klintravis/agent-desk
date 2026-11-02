## Why

`desk wt discard <slug>` run from a shell whose cwd is inside the worktree failed half-way on Windows: the folder stayed (locked by the shell) and the board claim stayed open (T-9). `wt merge` and `wt remove` have the same trap.

## What Changes

- `wt discard`, `wt remove` and `wt merge` check up front that the current directory is not inside the worktree (resolved, case-insensitive on Windows); if it is they exit 1 with `cd out of <path> first` before changing anything.
- `wt discard`: when `git worktree remove` fails for another reason it prunes; if git still lists the worktree nothing else changes and the command fails; if git unregistered it but the folder stayed, it finishes the discard (branch, claim release) and warns, as `wt merge` already does.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: requirements `wt remove`, `wt discard`, new `wt merge current directory`.

## Impact

`lib/wt.mjs`, `test/wt.test.mjs`, CHANGELOG. Not breaking.
