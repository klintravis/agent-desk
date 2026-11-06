## Why

With an unknown top-level key in `desk.config.json`, `wt`, `board` and `check` refuse, but `desk status` printed a bare screen and exited 0 without saying why (T-277). Status must keep working, since the pane depends on it, but the owner has to see the refusal. `todo` commands never load the config except to default the area (guarded), and the spec asks nothing more of them: unchanged.

## What Changes

- `desk status` prints `Warning: <refusal>` directly under its heading when `desk.config.json` is refused; `desk status --json` has `warnings` (array of strings) then, absent otherwise. Exit stays 0.
- `schemas/desk-status.schema.json` lists optional `warnings`.

## Capabilities

### Modified Capabilities
- `desk-cli`: new requirement `Config warning on the status screen`.
