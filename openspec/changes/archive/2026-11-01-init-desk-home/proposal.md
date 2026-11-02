## Why

`desk init` creates a new desk but honoured `DESK_HOME` over the current folder. Run from a session inside another desk it wrote `AGENTS.md` and the workspace file into that desk (T-3).

## What Changes

- `desk init` targets the current folder, never `DESK_HOME`. Other commands resolve the desk as before.

## Capabilities

### Modified Capabilities
- `desk-init`: requirement `Files written`.

## Impact

`lib/init.mjs`, README, CHANGELOG, test. A script that relied on `DESK_HOME` to point `init` elsewhere must `cd` there first.
