## Why

The README quickstart and global-install lines name the release tag so a new user gets a release, not the default branch. `bump` must keep those pins current (T-279).

## What Changes

- `release.mjs bump` rewrites the README `npx`/`npm install -g github:klintravis/agent-desk` pins to `#v<version>`.

## Capabilities

### Modified Capabilities
- `release`: "Version bump" gains a scenario.
