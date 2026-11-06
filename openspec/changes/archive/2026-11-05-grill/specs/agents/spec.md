## MODIFIED Requirements

### Requirement: Slash-only report skills
`ponytail-debt`, `ponytail-audit` and `grill` SHALL set `disable-model-invocation: true`, and no other skill of the kit SHALL.

#### Scenario: Only the slash-only skills
- **WHEN** the kit's `skills/*/SKILL.md` are searched for `disable-model-invocation: true`
- **THEN** exactly `grill`, `ponytail-debt` and `ponytail-audit` match

## ADDED Requirements

### Requirement: Grill interview
`skills/grill/SKILL.md` SHALL be at most 2560 bytes and SHALL end an interview only when `desk todo start` would pass for the todo, no open question remains and the owner confirms, never starting work in that turn.

#### Scenario: Size
- **WHEN** `wc -c skills/grill/SKILL.md` runs
- **THEN** it prints at most 2560
