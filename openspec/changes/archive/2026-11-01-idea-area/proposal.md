## Why

The owner has quick ideas that are not yet work and may never be. The todo list can hold them, but `todo next` and the plain `todo list` (which kickoff reads for work) would offer them to agents (T-60).

## What Changes

- New todo area `idea`. `todo next` without `--area` and `todo list` without `--area` or `--all` skip it.
- `--area idea` shows them; `todo set T-n --area <repo id>` promotes one, `todo drop` discards one.

## Capabilities

### Modified Capabilities
- `todos-and-board`: requirement `todo next` and the `todo list` requirement.

## Impact

`bin/desk.mjs`, README, `templates/AGENTS.md`, inventory, CHANGELOG. Not breaking.
