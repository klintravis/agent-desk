## Why

In `desk status`, with nothing kept for a kind (CI runs, pull requests, review-row pull requests), one repo whose `gh` call failed made that kind unavailable for every repo, and null was written to `status-gh.json` (T-204). The spec said "each repo is judged on its own" but that held only once something was kept.

## What Changes

- A failing repo affects only its own rows, kept or not: with nothing kept it contributes no rows and the other repos show theirs.
- A kind is unavailable (null) only when every repo's call failed and nothing is kept; a read that fails outright never overwrites a kept value.
- The spec and README wording says what happens.

## Capabilities

### Modified Capabilities
- `desk-cli`: requirement "Status JSON" (the kept-answers paragraph, one new scenario).
