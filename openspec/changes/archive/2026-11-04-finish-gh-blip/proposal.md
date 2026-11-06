## Why

`desk wt finish` ended with exit 1 when one `gh run list` call failed during the wait for the first CI run, although the push had worked. A network blip should not end a 5-minute wait. T-223.

## What Changes

- While waiting for the first CI run, a failed `gh` call counts as "no run yet" and the poll goes on until the deadline. At the deadline the error stays `no CI run found for <sha> after 5 minutes`, or names the last `gh` error when the last call failed (`gh` not installed still fails at once). `ciRuns` is unchanged for its other callers.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: requirement "wt finish", scenario "CI report".
