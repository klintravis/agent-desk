## MODIFIED Requirements

### Requirement: Clearing ownership
`desk tidy --apply` SHALL clear `owner` on each open, active or blocked todo whose owner is dead, by appending one line
to `todo.jsonl` that sets `owner` to an empty string and adds a note naming the old owner and the transcript's age. It
SHALL change no other field, and SHALL write nothing for a todo with no owner or for a done or dropped todo. It SHALL
re-read each todo immediately before clearing and SHALL write nothing for one whose owner is no longer the dead owner the
snapshot named or that is no longer open.

#### Scenario: Owner set meanwhile
- **WHEN** a session runs `desk todo start T-1` after tidy took its snapshot and before it clears T-1
- **THEN** T-1 keeps the new owner and no line is written for it

#### Scenario: Owner cleared
- **WHEN** `desk tidy --apply` runs and active T-1 has a dead owner
- **THEN** T-1 has an empty `owner`, is still active, keeps its `state` and `next`, and has a note naming the old owner

#### Scenario: Second run
- **WHEN** `desk tidy --apply` runs twice
- **THEN** the second run appends no line for T-1

#### Scenario: Done todo
- **WHEN** a done todo has a dead owner
- **THEN** no line is written for it

#### Scenario: Taking over
- **WHEN** a session runs `desk todo start T-1` after the owner was cleared
- **THEN** that session is T-1's owner as usual
