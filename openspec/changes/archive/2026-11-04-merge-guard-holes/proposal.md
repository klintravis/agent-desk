## Why

The merge guard judged a bare `git push` or `git merge` by the branch the directory was on when the command started, so `git checkout main && git merge agent/x && git push` from `agent/x` moved `origin/main` while `git push origin main` was refused. A BOM in `desk.config.json` made `loadConfig` throw, and the guard fails open, so a saved-by-an-editor BOM switched the guard off for every command (T-206).

## What Changes

- A `git checkout` or `git switch` earlier on a line adds its branch to what a later bare push or merge on that line is judged against. It only ever adds a refusal. A file checkout, a detached head and a name only git can resolve add nothing.
- `loadConfig` strips a leading BOM, as the settings file read already does.
- The guard's not-covered lists name `cmd /c` and the switches it cannot read.

## Capabilities

### Modified Capabilities
- `session-context`: new "Merge guard branch switches"; "Merge guard fails open" gains a BOM scenario.
