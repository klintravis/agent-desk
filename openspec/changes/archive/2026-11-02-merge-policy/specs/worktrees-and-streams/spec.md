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
- **AND** `merged` is posted, todos started with that slug are closed and the worktree is removed

#### Scenario: Unpushed commits
- **WHEN** the local branch differs from `origin/<branch>`
- **THEN** merge fails telling the caller to run `wt finish` first

#### Scenario: Not a fast-forward
- **WHEN** the default branch has moved past the branch's base
- **THEN** merge fails telling the caller to rebase, finish `--rebased` and re-run CI

#### Scenario: No verdict
- **WHEN** the board has no verdict for the slug
- **THEN** merge fails with `merge blocked: no verdict on the board`

## ADDED Requirements

### Requirement: wt merge under review
On a repo with `merge: "review"`, `wt merge <slug> --findings <file>` SHALL apply the unpushed, CI and verdict gates and end by opening or updating a pull request against the default branch. It SHALL never fast-forward, push or otherwise change the default branch or the main checkout.

#### Scenario: All gates pass and no PR exists
- **WHEN** the gates pass for the local head and `gh pr list --head <branch> --state all` returns no PR, a PR from a fork counting as none
- **THEN** a PR is created with `gh pr create --base <default> --head <branch>` and the body on stdin
- **AND** a board `note` names the PR number and sha, the URL is printed, the exit code is 0, and the worktree, claim and todos stay

#### Scenario: Updating an open PR
- **WHEN** the gates pass and the branch has an open PR
- **THEN** the PR's whole body is replaced with `gh pr edit` and the URL is printed

#### Scenario: A gate fails
- **WHEN** the branch is unpushed, CI is not `success`, or the newest verdict is not `MERGE @<head sha>`
- **THEN** it fails with the same message as under `direct` and no PR is created or changed

#### Scenario: No findings file
- **WHEN** no `--findings` is given and the branch has no open PR that can be reported and no merged PR holding the head
- **THEN** it fails naming `--findings <file>` and nothing is created

#### Scenario: Open PR, no findings file
- **WHEN** no `--findings` is given and the branch has an open PR
- **THEN** it prints the PR's state and URL, changes nothing and exits 0

#### Scenario: Closed without merging at this head
- **WHEN** the newest PR is `CLOSED` and its head is the local head
- **THEN** it fails telling the caller to add commits with a new verdict, or to run `desk wt discard`

#### Scenario: No gh or no origin
- **WHEN** the repo has no `gh` value or no `origin`, or the `gh pr list` call fails
- **THEN** it exits 1 naming what is missing and states nothing was merged
- **AND** it never falls back to a fast-forward

### Requirement: Closing after a merge on the server
On a `review` repo, `wt merge <slug>` SHALL close the work when the branch's PR is `MERGED` and holds the local head, whatever merge method the server used, and SHALL not need the gates or `--findings` to do so.

#### Scenario: Squash or rebase merge
- **WHEN** the PR is `MERGED`, and the local head is an ancestor of `pull/<n>/head` fetched from `origin`
- **THEN** `merged` is posted naming the PR, todos started with that slug are closed, and the worktree and local branch are removed without requiring the branch to be an ancestor of the base ref

#### Scenario: Commits added on the server before the merge
- **WHEN** the PR head has commits after the local head
- **THEN** the work closes the same way

#### Scenario: Branch deleted on the server
- **WHEN** the PR is `MERGED` and `origin/<branch>` no longer exists
- **THEN** the work closes the same way

#### Scenario: Local commits not in the PR
- **WHEN** the PR is `MERGED` and the local head is not an ancestor of its head
- **THEN** nothing is closed or deleted and the command continues as for a branch with no PR

### Requirement: wt remove under review
On a `review` repo, when `wt remove` fails because the branch is not in `origin/<default>`, the error SHALL also name `desk wt merge <slug>` as the way to close after a merge on the server.

#### Scenario: Squash-merged branch
- **WHEN** `wt remove x` runs on a `review` repo and the branch is not an ancestor of `origin/<default>`
- **THEN** nothing is removed and the error names `desk wt merge x`

### Requirement: wt merge into another worktree
`wt merge <slug> --into <other-slug>` SHALL merge the branch of `<slug>` into the branch of `<other-slug>` in that worktree, on either policy, and then close `<slug>`. It SHALL need neither `gh` nor `origin`, and SHALL NOT apply the CI or verdict gates, because the target's own `wt merge` gates cover the combined head.

#### Scenario: Clean merge
- **WHEN** both worktrees exist in the same repo and are clean, and the target is on `<branchPrefix><other-slug>`
- **THEN** the target gets the merge, `merged` is posted for the source naming the target branch, the source's todos are closed and its worktree and local branch are removed

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
