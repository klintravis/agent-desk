## Why

The repo has no release process: nothing bumps the version, nothing makes `package.json` and `.claude-plugin/plugin.json` agree (the CHANGELOG only claims it), and no GitHub release is created from a tag (T-31).

## What Changes

- `scripts/release.mjs bump <version>` writes the version into both files and files the CHANGELOG Unreleased entries under it.
- `scripts/release.mjs notes <tag>` prints a version's CHANGELOG entries after checking the tag against both files.
- `.github/workflows/release.yml`: on a pushed tag `v*`, require the commit to be on `main`, run `npm test`, create the GitHub release from `notes`.
- `npm test` gains `test/release.test.mjs`, which also fails when the two versions differ.
- README "Releasing", CHANGELOG, inventory rows. No npm publish.

## Capabilities

### New Capabilities
- `release`: version bump, release notes, the tag-triggered workflow.

## Impact

`scripts/release.mjs`, `.github/workflows/release.yml`, `test/release.test.mjs`, `package.json` test script, README, CHANGELOG, `openspec/inventory.md`. No change to the CLI or the plugin.
