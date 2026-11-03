## Why

`desk wt finish` waits on `gh run watch` with no limit: if the runner is down, a queued run never starts and finish hangs silently (T-57).

## What Changes

- The CI wait of `wt finish` is bounded at 30 minutes for all of a commit's runs together (real runs take 1-2 minutes).
- At the bound the watch is killed; the existing report follows: CI `running`, a `Still running: gh run watch ...` line per open run, exit code 1.
- No new option or config.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: the CI wait of `wt finish`.
