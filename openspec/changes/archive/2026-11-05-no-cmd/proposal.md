## Why

ThreatLocker on the owner's work PC blocks the generated `desk.cmd`. PowerShell and cmd already get the direct `node` form in the session context, so the shim has no use left.

## What Changes

- **BREAKING** `desk init` and `desk sync` write only the `desk` (sh) shim. `desk sync` deletes an existing `desk.cmd` that carries the `written by desk sync` marker and leaves one without it alone with a warning. Nothing to do on upgrade; in PowerShell or cmd use the `node` form.
- The `.gitignore` template and the VS Code hidden list drop `desk.cmd`.

## Capabilities

### Modified Capabilities
- `desk-sync`: the Shims requirement.
- `desk-init`: the Files written and Shims requirements.
- `session-context`: the Desk rules requirement no longer says what `desk.cmd` is not.
