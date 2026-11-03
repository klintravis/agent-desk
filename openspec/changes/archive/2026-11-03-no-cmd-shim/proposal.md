## Why

Application control on some Windows machines blocks `desk.cmd` (T-153). PowerShell and cmd users, and agents in those shells, run the kit directly with node instead.

## What Changes

- The session context's closing line gives, besides the bash `desk` shim, the PowerShell form `$env:DESK_HOME = '<desk>'; node '<kit>\bin\desk.mjs' ...` and the cmd form `set "DESK_HOME=<desk>" && node "<kit>\bin\desk.mjs" ...` with the desk's real paths; it no longer names `desk.cmd`.
- The `desk init` hint, `templates/AGENTS.md`, the four skills and the README give the same form; the README notes the limits.
- `desk.cmd` is still written by `desk sync` and `desk init`, unchanged.

## Capabilities

### Modified Capabilities
- `session-context`: the closing command line.

## Decisions

- `DESK_HOME` wins over the current folder (`findDesk`), so the direct form selects the desk from any folder, a worktree included.
- `<kit>` is the desk's pinned kit (`deskKit`), as in the shim.
