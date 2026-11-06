## Why

Every plain `desk status` run made a full GitHub round, and the Desk pane, the VS Code sidebar and `status --watch` each run one a minute in every session. The open-PR GraphQL query costs 52 points per repo per call (measured with `rateLimit(dryRun:true)`), so one pane alone spent about 3,100 of the 5,000 points an hour, and two sessions ran the budget dry (T-287, T-288, T-290).

## What Changes

- A plain `desk status` run reuses `status-gh.json` while it is under 55 seconds old (file mtime), so every instance on the desk shares one round a minute. `--cached` is unchanged.
- The open-PR read is a cheap list (`number`, `headRefName`, `isCrossRepository`, `reviewDecision`, `updatedAt`); the comments, reviews and threads query runs only for PRs whose `updatedAt` or review decision differs from the kept row, one aliased query per repo. Kept PR rows carry `updatedAt`; rows kept without it are asked once. The `prs` output is unchanged.
- Before a round, status reads `gh api rate_limit` (free). Under 20% remaining on `core` or `graphql` it skips the round, shows the kept answers and adds a `Warning:` naming the budget and its reset time. If `rate_limit` fails the round runs as before.
- The agent rules template tells agents to read `desk status --cached --json` for CI and PR state instead of calling `gh pr` or `gh run`.

## Capabilities

### Modified Capabilities
- `desk-cli`: new requirement `GitHub budget on the status screen`.
