## ADDED Requirements

### Requirement: Merge guard branch switches
A `git checkout` or `git switch` that names a branch SHALL add that branch to what every later bare push or merge on the same line is judged against, alongside the directory's current branch. The command SHALL be refused when any of those branches is outside the `branchPrefix`. A switch SHALL only add a refusal, never lift one, and SHALL count whatever its directory, its subshell or its success, since the guard cannot see whether it worked or which repo it moved.

#### Scenario: A switch before a bare push or merge
- **WHEN** the command on `agent/x` is `git checkout main && git merge agent/x && git push`, or the PowerShell command is `git switch main; git push origin HEAD`
- **THEN** it is refused

#### Scenario: Create forms
- **WHEN** the command on `agent/x` is `git switch -c main && git push`, `git checkout -B main origin/main; git push` or `git switch --cre main && git push`
- **THEN** it is refused

#### Scenario: A switch in a subshell or another folder
- **WHEN** the command on `agent/x` is `(git checkout main); git push` or `git checkout main && cd sub && git push`
- **THEN** it is refused

#### Scenario: A file checkout
- **WHEN** the command on `agent/x` is `git checkout -- f && git push`, `git checkout main -- f && git push` or `git checkout main f && git push`
- **THEN** it is allowed

#### Scenario: A switch after the push
- **WHEN** the command on `agent/x` is `git push; git checkout main`
- **THEN** it is allowed

#### Scenario: An explicit refspec
- **WHEN** the command on `agent/x` is `git checkout main && git push origin agent/x`
- **THEN** it is allowed, because the refspec names the branch

#### Scenario: A switch cannot lift a refusal
- **WHEN** the command on `main` is `git checkout agent/y && git push`
- **THEN** it is refused

#### Scenario: A switch only git can resolve
- **WHEN** the command on `agent/x` is `git switch - && git push`, `git checkout @{-1} && git push` or `git checkout $B && git push`
- **THEN** it is allowed, and these forms are listed as not covered

## MODIFIED Requirements

### Requirement: Merge guard fails open
An error in the guard's config, git or input SHALL allow the command. A command the parser cannot read is no such error: it SHALL be refused when it names `push` or `merge`, or has a backslash after `$'`. The denial SHALL say why, and SHALL name `desk wt merge` and that a person merges on the server.

#### Scenario: Unreadable config
- **WHEN** `desk.config.json` cannot be parsed, or git fails
- **THEN** the command is allowed

#### Scenario: A BOM in the config
- **WHEN** `desk.config.json` starts with a byte order mark and the command is `git push origin main` in a `review` repo
- **THEN** the config loads and the command is refused

#### Scenario: Denial text
- **WHEN** a command is refused
- **THEN** the reason names the protected branch, or that it cannot read the line, and `desk wt merge`
