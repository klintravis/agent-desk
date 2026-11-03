## MODIFIED Requirements

### Requirement: Desk pane CI and verdict colours
A branch's state word SHALL be the `state` of `desk status --json`, which the pane colours and ranks and does not recompute: green for `ready`, red for `CI failed` and `fixes needed`, orange for every other word.

#### Scenario: A pass on an older commit
- **WHEN** the CLI reports `CI stale` or `needs review` for a branch
- **THEN** its state word is orange, not green

#### Scenario: Behind the default branch
- **WHEN** the CLI reports `rebase`
- **THEN** its state word is `rebase`, in orange
