## MODIFIED Requirements

### Requirement: PR state on the status screen
The merged scenario applies only when the PR holds the branch's head (its head, or a commit on top of it, as `desk wt merge` tests); a merged PR that does not SHALL show `PR #n merged` without `desk wt merge`, and `--json` SHALL mark its `pr` with `stale: true`. An open fork PR with the branch's name SHALL NOT fill the branch's PR review row.

#### Scenario: Merged, but not this head
- **WHEN** the newest PR is merged and does not hold the branch's head
- **THEN** the row says the PR is merged without naming `desk wt merge`

#### Scenario: Fork PR with the same branch name
- **WHEN** an open PR from a fork has the branch's name
- **THEN** its comments, threads and review decision do not fill the branch's PR review row
