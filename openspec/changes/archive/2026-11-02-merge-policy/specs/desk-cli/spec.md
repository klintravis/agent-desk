## ADDED Requirements

### Requirement: Branch protection warning in check
For each `review` repo, `desk check` SHALL read through `gh api` whether the default branch, and `main` when it differs and exists, is protected on the server, and SHALL print a line for each. These lines SHALL never fail the check or change its exit code. A desk with no `review` repo SHALL make no such call and print no such line.

#### Scenario: Protected
- **WHEN** `repos/<gh>/branches/<b>` answers `protected: true`, or `repos/<gh>/rules/branches/<b>` lists rules
- **THEN** an `ok` line names the repo and the branch

#### Scenario: Not protected
- **WHEN** the first answers `protected: false` and the second lists none
- **THEN** a `warn` line says the branch has no protection on the server and that only a server rule is a guarantee

#### Scenario: Cannot read
- **WHEN** `gh` is missing, has no token, answers 403 or does not answer within 15 seconds
- **THEN** a `warn` line says the protection cannot be read, with the reason, and that only a server rule is a guarantee

#### Scenario: Other main absent
- **WHEN** the default branch is not `main` and `main` answers 404
- **THEN** no line is printed for `main`

#### Scenario: No gh value or no origin
- **WHEN** a `review` repo has no `gh` value or no `origin`
- **THEN** a `warn` line says `wt merge` will refuse on that repo

### Requirement: Merge setting change flag in check
`desk check` SHALL warn when a repo's `merge` in the working `desk.config.json` differs from the same file at the desk folder's upstream commit (`HEAD` when it has no upstream). It SHALL never fail the check on this.

#### Scenario: Changed
- **WHEN** a repo was `review` at the upstream and is `direct` or missing in the working file, or the reverse
- **THEN** a `warn` line names the repo, the old value and the new value

#### Scenario: Desk folder not in git
- **WHEN** the desk folder is not a git repo
- **THEN** no comparison runs and nothing is printed

### Requirement: PR state on the status screen
For each open branch of a `review` repo, `desk status` SHALL show the state of its PR, and `desk status --json` SHALL give the branch row an optional `pr` with `number`, `state` and `url`. Rows of `direct` repos SHALL not change. A failed lookup SHALL leave `pr` out and SHALL NOT fail the command.

#### Scenario: Open
- **WHEN** the branch has an open PR
- **THEN** the row says PR number, open, and that a person merges

#### Scenario: Merged on the server
- **WHEN** the branch's newest PR is merged
- **THEN** the row names `desk wt merge <slug>` as the way to close

#### Scenario: Closed
- **WHEN** the newest PR is closed without merging
- **THEN** the row says so

#### Scenario: Direct repo
- **WHEN** the repo is `direct`
- **THEN** no PR lookup is added and the row's text and JSON are unchanged
