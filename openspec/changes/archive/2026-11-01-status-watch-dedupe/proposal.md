## Why

`desk status --watch` printed `CTX>250k:` again when an agent's peak fell below 250k (its transcript pruned or compacted) and crossed again; a watch restart does not repeat it, since the first look seeds the previous peaks (T-29).

## What Changes

- `CTX>250k:` prints once ever per session and agent: a note on slug `ctx` starting `<session> <agent> ` marks it announced, posted with the line (the OVERLAP/OWNER+ pattern).

## Capabilities

### Modified Capabilities
- `desk-cli`: requirement `Status watch` (scenario CTX alert announced once).

## Impact

`bin/desk.mjs` `watchDiff`; README, CHANGELOG.
