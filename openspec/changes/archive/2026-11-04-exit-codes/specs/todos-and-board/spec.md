## MODIFIED Requirements

### Requirement: Board kinds and posting
`board post <kind> <slug> [text] [--repo id]` SHALL append `{ts, from, kind, slug, text, repo?}` where
kind is one of `claim`, `release`, `ci`, `merged`, `verdict`, `note`, the slug matches
`[a-z0-9][a-z0-9-]*`, and text is cut to 120 characters. `--repo <id>` SHALL be accepted anywhere after `board`, including before the kind. A bad kind or slug SHALL print `board: bad post ...`, append nothing and make the command exit 1. An append failure prints its error and exits 0, and the desk's own posts (worktree commands, `status --watch`) never fail their caller.

#### Scenario: Bad kind
- **WHEN** `board post wibble x` runs
- **THEN** nothing is appended and the exit code is 1

#### Scenario: Repo first
- **WHEN** `board post --repo a claim foo` runs
- **THEN** a `claim` of `foo` with `repo` `a` is appended

### Requirement: board check
`board check <slug>` SHALL print `yours` when the open claim is this session's, `unclaimed` when there is
none, and otherwise print `claimed by <id> <age> ago: stop and report` and exit 1. With no slug it SHALL print `usage: desk board check <slug>` and exit 1.

#### Scenario: Foreign claim
- **WHEN** another session holds the open claim
- **THEN** the command exits 1

#### Scenario: No slug
- **WHEN** `board check` runs with no slug
- **THEN** it prints the usage line and exits 1
