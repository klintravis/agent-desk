## ADDED Requirements

### Requirement: walkthrough skill
The kit SHALL ship a `walkthrough` skill that reads the open `watch` todos about the pane at run time (it SHALL NOT name todo ids), presents each in turn as data, asks the owner for `pass`, `fail` or `skip`, and records the answer only on that todo: a note, plus `todo done` on `pass`. It SHALL write nothing on `skip`.

#### Scenario: Pass
- **WHEN** the owner answers `pass` for an open pane check
- **THEN** that todo gets a note and is marked done, and no other todo changes

#### Scenario: Fail
- **WHEN** the owner answers `fail` with what they saw
- **THEN** the note quotes it and the todo stays open
