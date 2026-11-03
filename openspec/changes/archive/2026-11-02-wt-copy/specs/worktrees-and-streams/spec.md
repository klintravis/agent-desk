## MODIFIED Requirements

### Requirement: wt new
`wt new <slug> [--repo id] [--base ref] [--no-build]` SHALL create a worktree on a new branch, claim it on the board and prepare it.

#### Scenario: Copy
- **WHEN** the repo config lists `copy` paths and the worktree exists
- **THEN** each path that exists in the repo's main checkout is copied to the same path in the worktree, before `install` and `build`, also with `--no-build`
- **AND** a path missing in the main checkout is skipped without failing, with a `copy: <path> not in <repo>, skipped` line
- **AND** a `copy` that is not an array, or a path that is absolute, contains `..` or is the repo root, makes `wt new` fail
