## Why

`desk tidy --apply` cleared a dead owner from its start-of-run snapshot, so an owner set by `desk todo start` after the snapshot was wiped (T-109).

## What Changes

- Before clearing, tidy re-reads the todo and skips it when the owner is no longer the dead one or the todo is no longer open.

## Capabilities

### Modified Capabilities
- `desk-tidy`: "Clearing ownership".
