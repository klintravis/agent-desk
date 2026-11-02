## Why

agent-desk goes public while daily work stays in a private repo whose CI runs on the owner's machine. A fork's pull request must never reach that machine, and the private repo has no hosted minutes for releases.

## What Changes

- `ci.yml` picks its runners by repository visibility: the self-hosted runner on a private repo, the hosted Linux, Windows and macOS matrix otherwise.
- `release.yml` skips a private repo; releases are created on the public repo.
- `scripts/release.mjs publish <tag>` pushes one commit per release to the public repo, so the private history stays private.
- README: install needs no read access; the release steps use `publish`; no runner is ever registered on the public repo.
- Fixtures and archived tasks drop a real database user name, machine paths and desk names, since all of it ships.

## Capabilities

### Modified Capabilities
- `release`: requirement `Release workflow`; new requirements `Publish to the public repo` and `CI runners`.

## Impact

`.github/workflows/`, `scripts/release.mjs`, README, CHANGELOG. Not breaking.
