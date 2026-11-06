## MODIFIED Requirements

### Requirement: Settings warning for an unignored local file
`desk settings` SHALL report that the desk's `.claude/settings.local.json` is not ignored by git, so the user's cache settings are not written to it, in its `warnings`, and SHALL NOT print it separately. It SHALL do so only when the desk has the `claude` harness.

#### Scenario: Not ignored, JSON
- **WHEN** `desk settings --json` runs, the desk has the `claude` harness, the user file has cache keys and the desk's `.claude/settings.local.json` is not ignored by git
- **THEN** `warnings` holds one entry naming the file as not ignored by git, and stderr holds no such line

#### Scenario: Not ignored, plain
- **WHEN** the same runs without `--json`
- **THEN** stderr holds that warning once as `warn <text>`

#### Scenario: Not ignored, without the claude harness
- **WHEN** the same runs on a desk whose harnesses are `copilot` only
- **THEN** `warnings` holds no such entry
