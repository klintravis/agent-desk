## ADDED Requirements

### Requirement: Strict flags
`desk wt` and `desk stream` SHALL accept only their own flags and SHALL fail with exit 1 otherwise.

#### Scenario: Unknown wt flag
- **WHEN** `desk wt` gets a flag other than `--repo`, `--base`, `--no-build`, `--no-wait`, `--rebased`, `--force` (for example `wt discard x --dry-run`)
- **THEN** the command fails with `unknown flag --x` and runs nothing

#### Scenario: Unknown stream flag
- **WHEN** `desk stream` gets a flag other than `--repo`, `--todo`, `--max-turns`, `--budget`, `--desk`, `--dry-run`
- **THEN** the command fails with `unknown flag --x`

#### Scenario: Missing value
- **WHEN** a value flag is last in the arguments or is followed by another `--flag`
- **THEN** the command fails with `--x needs a value`

### Requirement: wt finish rejected push
When git rejects the push of `wt finish` as non-fast-forward, the error SHALL say to rerun with `--rebased`.

#### Scenario: Amended after a push
- **WHEN** the pushed branch was amended or rebased and `wt finish` runs without `--rebased`
- **THEN** it fails with `git push failed: ... rerun with --rebased`

### Requirement: wt merge with an unremovable worktree
When the merge is pushed but `git worktree remove` fails, `wt merge` SHALL show git's reason, SHALL still close the work and exit 0 with a warning only when git no longer lists the worktree, and SHALL otherwise keep the worktree and the claim and exit 1.

#### Scenario: Git refuses the remove
- **WHEN** `git worktree remove` fails after the merge was pushed and the worktree is still listed after a prune (modified or untracked files, a lock)
- **THEN** git's reason is shown, nothing is released and the command fails with `git worktree remove failed`, naming `desk wt remove <slug>`

#### Scenario: Folder left after git unregistered the worktree
- **WHEN** `git worktree remove` fails after the merge was pushed and the worktree is no longer listed after a prune (the folder could not be deleted, such as a shell holding it on Windows)
- **THEN** it deletes the local branch when git allows, drops the stream file, posts `release`, and prints a warning naming the folder to remove by hand
- **AND** the exit code is 0
