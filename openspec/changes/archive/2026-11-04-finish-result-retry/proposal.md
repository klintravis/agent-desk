## Why

`desk wt finish` exited 1 with no CI line and no `ci` board post when the one `gh run list` call that reads the result after the watch failed, even with CI green. T-231.

## What Changes

- That read is tried up to 3 times, 3 seconds apart, as the first-run poll treats a blip. If all fail, the error names the sha and the `gh` error and says CI's result is unknown. `gh` not installed still fails at once.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: requirement "wt finish", scenario "CI report".
