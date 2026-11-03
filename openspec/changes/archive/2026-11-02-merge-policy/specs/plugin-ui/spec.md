## ADDED Requirements

### Requirement: Desk pane merge policy
The Desk pane SHALL show the PR state from `desk status --json` on the row of a `review` branch, and `review` on that repo's Roots line. A `direct` repo's rows SHALL not change, and verdict colours SHALL not change.

#### Scenario: Waiting for a person
- **WHEN** a `review` branch has an open PR and a `MERGE` verdict
- **THEN** the row shows the PR as open and the verdict is not coloured as a failure

#### Scenario: Merged on the server
- **WHEN** a `review` branch's PR is merged
- **THEN** the row names `desk wt merge <slug>`
