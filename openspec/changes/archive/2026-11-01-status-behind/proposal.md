## Why

`wt merge` is fast-forward only, so a branch behind the default branch must be rebased first; `desk status` did not show that until the merge failed (T-17).

## What Changes

- An open-branch line in `desk status` ends with `; behind <default> by N, rebase` when N > 0, counted with `git rev-list --count` against `origin/<defaultBranch>` (else the local default branch). No fetch.

## Capabilities

### Modified Capabilities
- `desk-cli`: requirement `Status screen` (scenario Branch behind the default branch).

## Impact

`bin/desk.mjs` `statusText`, `gatherStatus`; README, CHANGELOG.
