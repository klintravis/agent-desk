## Why

The `NEXT.md` migration moves an open todo to area `watch` when a watch item names only that todo, and says nothing. The item may only cite the todo, so the owner needs to see the move and the way back (T-83).

## What Changes

- The move prints one line per moved todo, with the `desk todo set` command that restores its area.
- The match itself does not change: it cannot tell a subject from a citation.
- No new option or config.

## Capabilities

### Modified Capabilities
- `desk-sync`: the output of the `NEXT.md` migration.
