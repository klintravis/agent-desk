## ADDED Requirements

### Requirement: Status JSON
`desk status --json` SHALL print one JSON object and a newline, built from the same gathered data as the
text screen and valid against `schemas/desk-status.schema.json`. Without `--json`, `desk status` SHALL
print the text screen unchanged. `--watch` SHALL take priority over `--json`.

#### Scenario: Fields
- **WHEN** `desk status --json` runs
- **THEN** the object has `v` (1), `at`, `decisions`, `active`, `claims`, `sessions`, `roots`, `branches`, `prs`, `overlaps`, `tokens` and `text`
- **AND** `sessions`, `prs`, `overlaps` and `tokens` are null when their source is unavailable or no lookup ran

#### Scenario: Parses and validates
- **WHEN** `desk status --json` runs in a desk
- **THEN** stdout parses as one JSON object that validates against the `desk-status` schema, and the command exits 0

#### Scenario: Same data as the text
- **WHEN** `desk status` and `desk status --json` run on the same desk state
- **THEN** the JSON `text` equals the text screen, apart from the time on the heading line
- **AND** the waiting decisions and claims in the JSON are the ones the text lists

#### Scenario: Sources down
- **WHEN** `gh` and the transcripts cannot be read
- **THEN** `sessions` is null, each branch's `ci` is `CI unavailable`, and the command exits 0
