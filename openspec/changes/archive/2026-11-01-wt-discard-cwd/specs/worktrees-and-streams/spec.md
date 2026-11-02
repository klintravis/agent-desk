## MODIFIED Requirements

### Requirement: wt discard
`wt discard <slug> [--force]` SHALL force-remove the worktree and delete the branch (`-D`), uncommitted
work included, and post `release` with the text `discarded`. It SHALL refuse, unless `--force`, when
another session holds the open claim. It SHALL fail with `cd out of <path> first` before changing anything when the current directory is inside the worktree. When `git worktree remove` fails, it SHALL prune; if git still lists the worktree it SHALL fail and change nothing else, otherwise (the folder stayed) it SHALL finish the discard and print a warning naming the folder.

#### Scenario: Foreign claim
- **WHEN** session B holds the claim and session A runs `wt discard x`
- **THEN** it fails naming B and nothing is removed

#### Scenario: Current directory inside the worktree
- **WHEN** `wt discard x` runs with the current directory inside the worktree of `x`
- **THEN** it exits 1 with `cd out of <path> first`; the worktree, the branch and the claim are untouched

### Requirement: wt remove
`wt remove <slug>` SHALL remove the worktree and delete its branch (`-d`) only when the branch is an
ancestor of the base ref, delete `streams/<slug>.md` if present, refresh the workspace file and post
`release` with the text `removed`. It SHALL fail with `cd out of <path> first` before changing anything when the current directory is inside the worktree. When `git worktree remove` fails, it SHALL prune; if git still lists the worktree it SHALL fail and change nothing else, otherwise (the folder stayed) it SHALL delete the branch when git allows, post `release` with the text `removed; folder left` and print a warning naming the folder.

#### Scenario: Not merged
- **WHEN** the branch is not in `origin/<default>`
- **THEN** remove fails with `... is not in ... yet; merge it first` and nothing is removed

## ADDED Requirements

### Requirement: wt merge current directory
`wt merge` SHALL fail with `cd out of <path> first`, before fetching or merging anything, when the current directory is inside the worktree.

#### Scenario: Current directory inside the worktree
- **WHEN** `wt merge x` runs with the current directory inside the worktree of `x`
- **THEN** it exits 1 with `cd out of <path> first` and nothing is merged or pushed
