## ADDED Requirements

### Requirement: Bare board lines
The board summary and claim ages SHALL print `?` for a board line's missing `from`, `ts`, `kind` or `slug`, never `undefined` or `NaN`.

#### Scenario: Bare board line
- **WHEN** a line of `board.jsonl` has no `from`, `ts`, `kind` or `slug`
- **THEN** the summary shows `?` for each, never `undefined` or `NaN`

#### Scenario: Claim without ts
- **WHEN** an open claim has no `ts`
- **THEN** its age reads `?`, not `NaN`
