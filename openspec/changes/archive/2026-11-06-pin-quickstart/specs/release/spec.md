## MODIFIED Requirements

### Requirement: Version bump
`node scripts/release.mjs bump <version>` SHALL require `<version>` to be `x.y.z` and greater than the current version, and the current `package.json`, `.claude-plugin/plugin.json` and `vscode/package.json` versions to agree.

#### Scenario: Further rules
It SHALL write the version into all three files, keeping their formatting, and insert `## <version> - <YYYY-MM-DD>` under `## Unreleased` in `CHANGELOG.md`, so the Unreleased entries become that version's and an empty `## Unreleased` stays on top. On any refusal it SHALL exit 1 and write nothing.

#### Scenario: Good bump
- **WHEN** the current version is 0.1.0, Unreleased has entries and `bump 0.2.0` runs
- **THEN** all three files say 0.2.0 and the entries sit under `## 0.2.0 - <today>` with an empty `## Unreleased` above

#### Scenario: README install pins
- **WHEN** `bump 0.2.0` runs and `README.md` has `npx github:klintravis/agent-desk` or `npm install -g github:klintravis/agent-desk`, pinned or not
- **THEN** each reads `...agent-desk#v0.2.0`

#### Scenario: Version not greater or not semver
- **WHEN** `bump 0.1.0`, `bump 0.0.9` or `bump 1.0` runs against 0.1.0
- **THEN** it exits 1 and no file changes

#### Scenario: Empty Unreleased
- **WHEN** `## Unreleased` has no entries
- **THEN** `bump` exits 1 and no file changes
