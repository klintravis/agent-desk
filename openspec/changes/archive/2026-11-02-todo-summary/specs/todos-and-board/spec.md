## ADDED Requirements

### Requirement: Todo summary
`todo add` and `todo set` SHALL take `--summary "<text>"`, a short form of the title for the Desk pane. It SHALL be cut to 60 characters, be optional, and appear in `desk status --json` on active todos. `todo show` and `todo list` SHALL keep showing the full title.

#### Scenario: Summary stored
- **WHEN** `todo add "<long title>" --summary "short"` runs, or `todo set T-n --summary "short"`
- **THEN** the todo has `summary` `short` and the title is unchanged

#### Scenario: Summary too long
- **WHEN** the summary is longer than 60 characters
- **THEN** it is stored cut to 60 characters

#### Scenario: Status carries it
- **WHEN** an active todo has a summary and `desk status --json` runs
- **THEN** the todo in `active` has `summary`, and the output validates against the status schema

#### Scenario: Old todo
- **WHEN** a todo has no summary
- **THEN** every command works as before
