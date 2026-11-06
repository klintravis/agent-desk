## Why

`desk wt finish` gave up with "no CI run found for <sha> after 60s" when GitHub registered the run late (seen once on a real push; the run showed queued soon after). T-219.

## What Changes

- `wt finish` waits up to 5 minutes (was 60 seconds) for the first CI run on the head. The value is one constant, `CI_RUN_WAIT_MS`, used by the poll loop and the error message. No option, no config.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: requirement "wt finish", scenario "CI report".
