## ADDED Requirements

### Requirement: Merge guard verdict
A shell command SHALL get a refusal verdict only when, in a repo with `merge: "review"`, it would push to, delete or merge into a branch outside that repo's `branchPrefix`, or when it is `gh pr merge`. An explicit tag ref is not a branch and SHALL be allowed. The rule SHALL live in a pure, Node-free module with a self-test table, and SHALL honour quoted text.

#### Scenario: Agent branches pass
- **WHEN** the command is `git push origin agent/x`, with or without `-u` or `--force`, or `git push origin agent/main`, and the prefix is `agent/`
- **THEN** it is allowed

#### Scenario: Refspecs and forms that reach a protected branch
- **WHEN** the command is `git push origin HEAD:main`, `agent/x:main`, `+HEAD:refs/heads/main`, `:main`, `--delete main`, `--all` or `--mirror`
- **THEN** it is refused

#### Scenario: Tag pushes pass
- **WHEN** the command is `git push origin refs/tags/v1.2`, `git push origin HEAD:refs/tags/v1.2`, `git push --tags` or `git push origin --tags`
- **THEN** it is allowed

#### Scenario: A bare short name stays refused
- **WHEN** the command is `git push origin v1.2`, and `v1.2` is outside the prefix
- **THEN** it is refused, because a short name cannot be told from a branch, and the reason names `refs/tags/v1.2` as the form that passes

#### Scenario: A branch beside --tags
- **WHEN** the command is `git push origin main --tags`
- **THEN** it is refused, because `main` is outside the prefix

#### Scenario: gh pr merge
- **WHEN** the command is `gh pr merge`, in a `review` repo
- **THEN** it is refused

#### Scenario: Other directories and chains
- **WHEN** the push is reached through `git -C <dir>`, `cd <dir> &&` or a chain of commands
- **THEN** the branch and the repo are read for that directory and that part of the chain

#### Scenario: No refspec
- **WHEN** the command is `git push`, `git push origin` or `git push origin HEAD`
- **THEN** the current branch of the directory decides, and a detached head is allowed

#### Scenario: Merge
- **WHEN** the command is `git merge <anything>` and the current branch is outside the prefix
- **THEN** it is refused, except `--abort` and `--quit`

#### Scenario: Updating an agent branch
- **WHEN** the command is `git merge origin/main` on `agent/x`
- **THEN** it is allowed

#### Scenario: Quoted text
- **WHEN** the command is `git commit -m "git push origin main"`
- **THEN** it is allowed

### Requirement: Merge guard scope
The guard SHALL find the desk with `findDesk` and map a command's directory to a repo through its git common directory. It SHALL refuse only on a `review` repo. It SHALL run as a plugin hook on the `Bash` and `PowerShell` tools and as a script taking the PreToolUse JSON, and SHALL be the same logic in both.

#### Scenario: Direct desk
- **WHEN** no repo of the desk is `review`
- **THEN** every command is allowed and no git process is started

#### Scenario: Mixed desk
- **WHEN** a desk has a `review` repo and a `direct` repo
- **THEN** `git push origin main` is refused in the first, in its worktrees too, and allowed in the second

#### Scenario: Unknown repo
- **WHEN** the directory's repo is not listed in the desk's config
- **THEN** the command is allowed

### Requirement: Merge guard fails open
Any error in the guard SHALL allow the command. The denial SHALL say why, and SHALL name `desk wt merge` and that a person merges on the server.

#### Scenario: Unreadable config
- **WHEN** `desk.config.json` cannot be parsed, or git fails
- **THEN** the command is allowed

#### Scenario: Denial text
- **WHEN** a command is refused
- **THEN** the reason names the protected branch and `desk wt merge`
