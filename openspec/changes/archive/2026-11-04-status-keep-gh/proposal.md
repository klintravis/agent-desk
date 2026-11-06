## Why

A `gh` blip during `desk status` replaced the kept CI and PR answers in `status-gh.json` with empty ones, so the Desk pane and `--cached` runs lost them until the next good run (T-203).

## What Changes

- A repo whose `gh` call fails keeps its kept CI runs, pull requests and review-row pull requests; a repo whose call succeeds replaces them, even with an empty answer. Per repo.

## Capabilities

### Modified Capabilities
- `desk-cli`: the "Status JSON" requirement.
