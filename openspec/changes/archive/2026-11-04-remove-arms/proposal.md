## Why

`todo done-slug`, `board merge-ok` and `board tail` had no caller left: `wt merge` and the session-start context call the code directly. `scripts/friction-scan.mjs` was unused. The owner ruled to remove them (T-196).

## What Changes

- **BREAKING**: `desk todo done-slug`, `desk board tail` and `desk board merge-ok` are removed; they exit 1 with the usage error.
- `scripts/friction-scan.mjs` is deleted.
- `doneSlug`, `mergeOk` and `summary` stay: `wt merge`, the status words and the session-start context use them.

## Capabilities

### Modified Capabilities
- `todos-and-board`: removes "todo done-slug"; "Merge gate" and "Board summary" lose their commands.
