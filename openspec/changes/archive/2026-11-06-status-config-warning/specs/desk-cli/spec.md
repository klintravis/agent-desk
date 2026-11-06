## ADDED Requirements

### Requirement: Config warning on the status screen
When `desk.config.json` is refused, `desk status` SHALL print `Warning: ` and the refusal message on a line directly under its heading, and `desk status --json` SHALL carry the messages in `warnings`, an array of strings valid against `schemas/desk-status.schema.json`. `warnings` SHALL be absent when the config loads. The command SHALL still exit 0.

#### Scenario: Unknown key
- **WHEN** `desk.config.json` holds an unknown top-level key and `desk status` runs
- **THEN** the screen has a `Warning:` line naming the key, and the exit code is 0
- **AND** `desk status --json` has `warnings` holding the same message

#### Scenario: Valid config
- **WHEN** the config loads
- **THEN** no `Warning:` line prints and `warnings` is absent
