## Why

`desk status` read the wrong PR in two cases. The GraphQL PR query had no `isCrossRepository`, so an open fork PR with the same branch name filled our slug's review row (T-127). A merged PR whose head was not the row's head (a new commit, a reused slug) still said `desk wt merge <slug> to close` (T-126).

## What Changes

- The PR query asks for `isCrossRepository` and fork PRs are dropped.
- The review-PR lookup also asks for `headRefOid`; a merged PR that does not hold the branch's head (git decides, as in `wt merge`; an object this clone lacks counts as held) gets `stale: true` in `--json` and its row says only `PR #n merged`.

## Capabilities

### Modified Capabilities
- `desk-cli`: PR state on the status screen.
