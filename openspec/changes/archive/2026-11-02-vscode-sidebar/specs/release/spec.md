## MODIFIED Requirements

### Requirement: Version bump
`node scripts/release.mjs bump <version>` SHALL require `<version>` to be `x.y.z` and greater than the current version, and the current `package.json`, `.claude-plugin/plugin.json` and `vscode/package.json` versions to agree. It SHALL write the version into all three files, keeping their formatting, and insert `## <version> - <YYYY-MM-DD>` under `## Unreleased` in `CHANGELOG.md`, so the Unreleased entries become that version's and an empty `## Unreleased` stays on top. On any refusal it SHALL exit 1 and write nothing.

#### Scenario: Good bump
- **WHEN** the current version is 0.1.0, Unreleased has entries and `bump 0.2.0` runs
- **THEN** all three files say 0.2.0 and the entries sit under `## 0.2.0 - <today>` with an empty `## Unreleased` above

#### Scenario: Version not greater or not semver
- **WHEN** `bump 0.1.0`, `bump 0.0.9` or `bump 1.0` runs against 0.1.0
- **THEN** it exits 1 and no file changes

#### Scenario: Empty Unreleased
- **WHEN** `## Unreleased` has no entries
- **THEN** `bump` exits 1 and no file changes

### Requirement: Release notes
`node scripts/release.mjs notes <tag>` SHALL exit 1 unless `<tag>` equals `v` plus the version in all of `package.json`, `.claude-plugin/plugin.json` and `vscode/package.json` and `CHANGELOG.md` has a section for that version. Otherwise it SHALL print that section's body, without its heading, to stdout.

#### Scenario: Matching tag
- **WHEN** all three files say 0.1.0 and `notes v0.1.0` runs
- **THEN** the body of `## 0.1.0 - <date>` is printed and the exit code is 0

#### Scenario: Wrong tag
- **WHEN** `notes v9.9.9` runs against 0.1.0
- **THEN** it exits 1 and prints nothing to stdout

### Requirement: Version consistency test
`npm test` SHALL fail when the `package.json`, `.claude-plugin/plugin.json` and `vscode/package.json` versions differ, or when `CHANGELOG.md` has neither a section for that version nor an `## Unreleased` section.

#### Scenario: Versions differ
- **WHEN** the three files carry different versions
- **THEN** `npm test` fails

