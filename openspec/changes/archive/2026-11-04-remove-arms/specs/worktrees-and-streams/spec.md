## MODIFIED Requirements

### Requirement: wt merge
On a repo with `merge: "direct"`, `wt merge <slug>` SHALL fast-forward the default branch to the local branch head only when every gate passes for that one sha.

#### Scenario: Gates
- **WHEN** `wt merge` runs
- **THEN** it requires the branch pushed to `origin` at that sha (when `origin` exists), CI `success` on it (when the repo has `gh`), a board verdict gate passing for exactly that sha (see `todos-and-board`), and the main checkout on the default branch and clean
- **AND** any failed gate stops the merge before the default branch changes

#### Scenario: Merge steps
- **WHEN** all gates pass
- **THEN** the default branch is fast-forwarded to `origin/<default>` and then to the sha (`--ff-only`) and pushed
- **AND** `merged` is posted, every `open`, `active` or `blocked` todo started with that slug becomes `done` with the note `merged (<slug>)`, and the worktree is removed

#### Scenario: Unpushed commits
- **WHEN** the local branch differs from `origin/<branch>`
- **THEN** merge fails telling the caller to run `wt finish` first

#### Scenario: Not a fast-forward
- **WHEN** the default branch has moved past the branch's base
- **THEN** merge fails telling the caller to run `desk wt rebase <slug>`, then get a new review

#### Scenario: No verdict
- **WHEN** the board has no verdict for the slug
- **THEN** merge fails with `merge blocked: no verdict on the board`

### Requirement: Closing after a merge on the server
On a `review` repo, `wt merge <slug>` SHALL close the work when the branch's PR is `MERGED` and holds the local head, whatever merge method the server used, and SHALL not need the gates or `--findings` to do so.

#### Scenario: Squash or rebase merge
- **WHEN** the PR is `MERGED`, and the local head is an ancestor of `pull/<n>/head` fetched from `origin`
- **THEN** `merged` is posted naming the PR, every `open`, `active` or `blocked` todo started with that slug becomes `done` with the note `merged (<slug>)`, and the worktree and local branch are removed without requiring the branch to be an ancestor of the base ref

#### Scenario: Commits added on the server before the merge
- **WHEN** the PR head has commits after the local head
- **THEN** the work closes the same way

#### Scenario: Branch deleted on the server
- **WHEN** the PR is `MERGED` and `origin/<branch>` no longer exists
- **THEN** the work closes the same way

#### Scenario: Local commits not in the PR
- **WHEN** the PR is `MERGED` and the local head is not an ancestor of its head
- **THEN** nothing is closed or deleted and the command continues as for a branch with no PR

### Requirement: wt merge into another worktree
`wt merge <slug> --into <other-slug>` SHALL merge the branch of `<slug>` into the branch of `<other-slug>` in that worktree, on either policy, and then close `<slug>`. It SHALL need neither `gh` nor `origin`, and SHALL NOT apply the CI or verdict gates, because the target's own `wt merge` gates cover the combined head.

#### Scenario: Clean merge
- **WHEN** both worktrees exist in the same repo and are clean, and the target is on `<branchPrefix><other-slug>`
- **THEN** the target gets the merge, `merged` is posted for the source naming the target branch, the source's todos are closed with the note `merged into <other-slug's branch> (<slug>)` and its worktree and local branch are removed

#### Scenario: Target's verdict no longer passes
- **WHEN** the target had `MERGE @<old head>` before the merge
- **THEN** a later `wt merge <other-slug>` fails the verdict gate, because the head changed

#### Scenario: Conflict
- **WHEN** the merge conflicts
- **THEN** the merge is aborted, the conflicted files are named, both worktrees stay as they were and the exit code is 1

#### Scenario: Merged by hand after a conflict
- **WHEN** the source is already an ancestor of the target
- **THEN** no merge is made and the source is closed

#### Scenario: Refused
- **WHEN** either worktree is missing or dirty, the repos differ, the target is on another branch, the current directory is inside the source, or `--findings` is also given
- **THEN** it exits 1 and nothing changes

#### Scenario: Held by another session
- **WHEN** either slug is claimed by another live session
- **THEN** it exits 1 unless `--force` is given
