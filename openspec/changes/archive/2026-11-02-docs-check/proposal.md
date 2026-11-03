## Why

The README and `openspec/inventory.md` drift from the code as commands and flags change, and the only check was a shell loop nobody ran (T-96).

## What Changes

- `scripts/docs-check.mjs [<checkout>]` compares the docs with the code, with no model and no dependency, and `npm test` runs it.
- It checks README links and the Node version, the `## Commands` table against the commands, actions and flags found in `bin/desk.mjs` and `lib/`, and `openspec/inventory.md` against the README and the code.
- The shell loop in `openspec/inventory.md` is replaced by a pointer to the script; rows that had drifted are corrected.

## Capabilities

### Modified Capabilities
- `release`: the docs drift check.
