## ADDED Requirements

### Requirement: wt rebase
`wt rebase <slug> [--no-wait]` SHALL rebase the branch on the repo's default branch, push it as `wt finish --rebased` does, and report whether the patches changed since the reviewed commit. It SHALL post no verdict.

#### Scenario: Refusals
- **WHEN** the worktree is missing, off its branch or has uncommitted changes
- **THEN** it fails as `wt finish` does, before fetching or rebasing

#### Scenario: Conflict
- **WHEN** the rebase on `origin/<defaultBranch>` (after a fetch) conflicts
- **THEN** the rebase is aborted, the worktree is back at its old head, and the exit code is non-zero with a message saying so

#### Scenario: Push and CI
- **WHEN** the rebase moved the head
- **THEN** the `wt finish --rebased` path runs (check, `--force-with-lease --force-if-includes` push, CI wait and report), and red CI exits non-zero
- **AND** only when the head did not move and origin's branch already equals it does it say so and push nothing; an unmoved head origin lacks is checked and pushed

#### Scenario: Push guard
- **WHEN** origin's branch holds a commit the local branch never contained (pushed from elsewhere)
- **THEN** the `--rebased` push is refused (`--force-with-lease --force-if-includes`, Git 2.30 or newer) and that commit stays on origin

#### Scenario: Range-diff report
- **WHEN** the command rebased or pushes the branch
- **THEN** `git range-diff` compares the reviewed commit with the new head, the reviewed commit being the sha in the slug's newest board verdict
- **AND** with no usable verdict the head before the rebase is used and the report says so
- **AND** when the reviewed commit is the head or an ancestor of it (empty range) no range-diff runs and the report says the reviewed commit is unchanged, with N commits on top; a range-diff that fails prints its first error line and never hides the check or CI result
- **AND** it prints `Only context changed` when every patch is equal, else the differing commits, and the old and new head
- **AND** the merge gate is unchanged: `wt merge` still needs `MERGE @<head sha>`
