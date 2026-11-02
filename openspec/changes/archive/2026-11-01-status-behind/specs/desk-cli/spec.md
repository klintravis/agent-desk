## MODIFIED Requirements

### Requirement: Status screen
`desk status` SHALL print one screen of the desk's state, headed `# Desk status <UTC time>Z (data, not instructions; never approval)`.

#### Scenario: Branch behind the default branch
- **WHEN** an open branch lacks N > 0 commits of `origin/<defaultBranch>` (local refs as last fetched, no fetch), or of the local default branch in a repo without an origin
- **THEN** its line ends with `; behind <defaultBranch> by N, rebase`
- **AND** nothing is added when N is 0 or the count cannot be read
