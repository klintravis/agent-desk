## Why

The desk folder shows the kit's plumbing (`desk`, `desk.cmd`, `node_modules`, `package.json`, `.github`, `.claude`, ...) next to the files people use. Hide it in VS Code (T-45).

## What Changes

- `desk sync` and `desk workspace` (and so `init`, `wt new`/`remove`/`discard`) add `files.exclude` entries to the desk folder's `.vscode/settings.json` for the plumbing files. Existing keys, and any exclude the user already set (even `false`), stay. An unparseable file is left unchanged and the command exits 1.
- The desk `.gitignore` template lists `.vscode/` (a generated per-user file, like `.claude/settings.local.json`).

## Capabilities

### Modified Capabilities
- `desk-sync`: new requirement `Plumbing hidden in VS Code`.

## Impact

`lib/sync.mjs`, `lib/init.mjs`, `test/sync.test.mjs`, README, CHANGELOG, inventory. Not breaking; not in the `.code-workspace` (a workspace-level exclude would hide `package.json` in the repos).
