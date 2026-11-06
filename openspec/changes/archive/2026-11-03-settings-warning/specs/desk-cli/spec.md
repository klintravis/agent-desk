## ADDED Requirements

### Requirement: Settings warning for an unignored local file
`desk settings` SHALL report that the desk's `.claude/settings.local.json` is not ignored by git, so the user's cache settings are not written to it, in its `warnings`, and SHALL NOT print it separately.

#### Scenario: Not ignored, JSON
- **WHEN** `desk settings --json` runs, the user file has cache keys and the desk's `.claude/settings.local.json` is not ignored by git
- **THEN** `warnings` holds one entry naming the file as not ignored by git, and stderr holds no such line

#### Scenario: Not ignored, plain
- **WHEN** the same runs without `--json`
- **THEN** stderr holds that warning once as `warn <text>`
