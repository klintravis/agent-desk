## Why

`CHANGELOG.md` merges with `merge=union`, which keeps both sides of a line a branch reworded: a rebased branch ended with the old and the new entry (config-strict, 2026-11-06, T-99). Nothing in the check saw it.

## What Changes

- `scripts/release.mjs` exports `changelogGaps`; `npm test` fails on a section with a repeated entry line or two entries naming one OpenSpec change, and `bump` refuses when `## Unreleased` has one.
- README Releasing: after a rebase across a release, move the entry back under `## Unreleased` (a misplaced entry is not detected).

## Capabilities

### Modified Capabilities
- `release`: new requirement "CHANGELOG duplicate entries".
