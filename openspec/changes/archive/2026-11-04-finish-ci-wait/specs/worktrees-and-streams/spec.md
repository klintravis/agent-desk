## MODIFIED Requirements

### Requirement: wt finish
`wt finish <slug> [--no-wait] [--rebased]` SHALL check the worktree, push its branch and report the CI result.

#### Scenario: Preconditions and push
- **WHEN** `wt finish` runs
- **THEN** the worktree must exist, be on its branch and have no uncommitted changes
- **AND** the repo's `check` command runs, then the branch is pushed with `-u origin <branch>` (`--force-with-lease --force-if-includes` with `--rebased`)

#### Scenario: Early stop
- **WHEN** the repo has no `origin` remote
- **THEN** it stops after the check
- **AND** for a repo without `gh` it stops after the push, and with `--no-wait` it prints the `gh run list` command and stops

#### Scenario: CI report
- **WHEN** it waits
- **THEN** it waits up to 5 minutes for a CI run on the head, watches every run on that commit, posts a `ci` line `<sha7> <conclusion>` and prints the conclusion
- **AND** when CI is not `success` it prints the failed-log or still-running command for each such run and sets exit code 1

#### Scenario: CI conclusion across runs
- **WHEN** a commit has two runs, one `success` and one `skipped`
- **THEN** the conclusion is `success`

#### Scenario: Any run still open
- **WHEN** one of several runs is not completed
- **THEN** the conclusion is `running`

#### Scenario: Wrong branch
- **WHEN** the worktree has another branch checked out
- **THEN** finish fails naming both
