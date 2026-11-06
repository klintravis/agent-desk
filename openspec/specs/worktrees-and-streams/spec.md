# worktrees-and-streams Specification

## Purpose

One worktree per piece of work, and unattended headless sessions that work in them. Implemented in
`lib/wt.mjs` (`desk wt new|finish|rebase|merge|remove|discard` and `desk stream`). Uses `git` and `gh` only,
the same on every OS.

## Requirements

### Requirement: Slugs and repo lookup
A slug SHALL match `[a-z0-9][a-z0-9-]*` and SHALL be unique desk-wide. A `wt` command SHALL act on the
repo given by `--repo`, else the repo whose worktree has that slug, else the only git repo. A repo of
kind `folder` SHALL be refused by every `wt` command with a message pointing at its path.

#### Scenario: Plain folder
- **WHEN** a `wt` command targets a repo of kind `folder`
- **THEN** it fails saying the folder has no worktrees

#### Scenario: Bad slug
- **WHEN** the slug is `Foo` or missing
- **THEN** the command fails with `slug must be lowercase letters, digits and dashes`

### Requirement: wt new
`wt new <slug> [--repo id] [--base ref] [--no-build]` SHALL create a worktree on a new branch, claim it on the board and prepare it.

#### Scenario: Worktree and branch
- **WHEN** `wt new` runs
- **THEN** it fetches `origin` (when the repo has one) and creates `<worktreesDir>/<worktreePrefix><slug>` on a new branch `<branchPrefix><slug>`
- **AND** the base ref is `--base`, else `origin/<defaultBranch>`, or the local default branch without `origin`

#### Scenario: Setup and claim
- **WHEN** the worktree exists
- **THEN** the checkout's settings are written (`sync`), an existing `.code-workspace` is refreshed and a `claim` with the text `from <base>` is posted
- **AND** the repo's `install` and `build` commands run from the worktree, each skipped when empty and `build` skipped by `--no-build`
- **AND** it prints `Ready: <dir> (branch <branch> from <base>)`

#### Scenario: Copy
- **WHEN** the repo config lists `copy` paths and the worktree exists
- **THEN** each path that exists in the repo's main checkout is copied to the same path in the worktree, before `install` and `build`, also with `--no-build`
- **AND** a path missing in the main checkout is skipped without failing, with a `copy: <path> not in <repo>, skipped` line
- **AND** a `copy` that is not an array, or a path that is absolute, contains `..` or is the repo root, makes `wt new` fail

#### Scenario: Folder exists
- **WHEN** the folder exists or the slug is already open in any repo
- **THEN** it fails

#### Scenario: Slug taken
- **WHEN** slug `x` is open in repo `a` and `wt new x --repo b` runs
- **THEN** it fails saying slugs are desk-wide

#### Scenario: No build
- **WHEN** `--no-build` is given and the repo has `install` and `build` commands
- **THEN** `install` runs and `build` does not

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
- **AND** a failed `gh` call during that wait counts as no run yet and the wait goes on; at the deadline the error is `no CI run found for <sha> after 5 minutes`, or names the `gh` error when the last call failed; `gh` not installed is no blip and fails at once
- **AND** the call that reads the result after the watch is tried up to 3 times, 3 seconds apart; if all fail the error names the sha and the `gh` error and says CI's result is unknown
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

### Requirement: wt merge
On a repo with `merge: "direct"`, `wt merge <slug>` SHALL fast-forward the default branch to the local branch head only when every gate passes for that one sha.

#### Scenario: Gates
- **WHEN** `wt merge` runs
- **THEN** it requires the branch pushed to `origin` at that sha (when `origin` exists), CI `success` on it (when the repo has `gh`), a board verdict gate passing for exactly that sha (see `todos-and-board`), and the main checkout on the default branch and clean
- **AND** any failed gate stops the merge before the default branch changes

#### Scenario: Merge steps
- **WHEN** all gates pass
- **THEN** with a remote, the default branch is fast-forwarded to `origin/<default>`, the sha is checked to descend from it, the sha is pushed to `origin/<default>`, and only then is the local default branch fast-forwarded to the sha (`--ff-only`); without a remote it is fast-forwarded to the sha
- **AND** a failed push does not move the default branch past `origin/<default>`, and a re-run closes the work once the sha is on `origin/<default>`, even after `origin` moved on
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

### Requirement: wt remove
`wt remove <slug>` SHALL remove the worktree and delete its branch (`-d`) only when the branch is an
ancestor of the base ref, delete `streams/<slug>.md` if present, refresh the workspace file and post
`release` with the text `removed`.

#### Scenario: Not merged
- **WHEN** the branch is not in `origin/<default>`
- **THEN** remove fails with `... is not in ... yet; merge it first` and nothing is removed

### Requirement: wt remove current directory
`wt remove <slug>` SHALL fail with `cd out of <path> first` before changing anything when the current directory is inside the worktree.

#### Scenario: Current directory inside the worktree
- **WHEN** `wt remove x` runs with the current directory inside the worktree of `x`
- **THEN** it exits 1 with `cd out of <path> first` and changes nothing

### Requirement: wt remove with an unremovable worktree
When `git worktree remove` fails, `wt remove <slug>` SHALL prune; if git still lists the worktree it SHALL fail and change nothing else, otherwise (the folder stayed) it SHALL delete the branch when git allows, post `release` with the text `removed; folder left` and print a warning naming the folder.

#### Scenario: Folder stayed
- **WHEN** `git worktree remove` fails and, after a prune, git no longer lists the worktree
- **THEN** remove posts `release` with `removed; folder left` and prints a warning naming the folder

### Requirement: wt discard
`wt discard <slug> [--force]` SHALL force-remove the worktree and delete the branch (`-D`), uncommitted
work included, and post `release` with the text `discarded`. It SHALL refuse, unless `--force`, when
another session holds the open claim. It SHALL return the todos started with `--slug <slug>` that are
active, or blocked with an owner, to `open`, clear their `slug`, `owner`, `state` and `next`, keep their notes, add the note `worktree <slug> discarded`
and print `reopened: T-n, ...`. An open todo merely tagged with the slug stays as it is.

#### Scenario: Foreign claim
- **WHEN** session B holds the claim and session A runs `wt discard x`
- **THEN** it fails naming B and nothing is removed

#### Scenario: A started todo
- **WHEN** `wt discard x` runs and T-1 was started with `--slug x`
- **THEN** T-1 is open with no slug and no owner, its notes kept and `worktree x discarded` added
- **AND** the output says `reopened: T-1`

### Requirement: wt discard current directory
`wt discard <slug> [--force]` SHALL fail with `cd out of <path> first` before changing anything when the current directory is inside the worktree.

#### Scenario: Current directory inside the worktree
- **WHEN** `wt discard x` runs with the current directory inside the worktree of `x`
- **THEN** it exits 1 with `cd out of <path> first`; the worktree, the branch and the claim are untouched

### Requirement: wt discard with an unremovable worktree
When `git worktree remove` fails, `wt discard <slug> [--force]` SHALL prune; if git still lists the worktree it SHALL fail and change nothing else, otherwise (the folder stayed) it SHALL finish the discard and print a warning naming the folder.

#### Scenario: Folder stayed
- **WHEN** `git worktree remove` fails and, after a prune, git no longer lists the worktree
- **THEN** discard finishes and prints a warning naming the folder

### Requirement: Stream start
`desk stream <slug> <task-file> [--todo T-n] [--desk] [--repo id] [--max-turns n] [--budget usd] [--dry-run]` SHALL start a headless `claude` session on the task, or fail for a bad slug or a missing task file.

#### Scenario: Start
- **WHEN** the stream starts
- **THEN** the prompt is written to `<scratchDir>/<slug>-prompt.txt`
- **AND** `claude -p --max-turns <n|80> --output-format stream-json --verbose` runs detached in the desk folder with the prompt as stdin, stdout in `<scratchDir>/<slug>-run.jsonl` and stderr in `<log>.err`
- **AND** the pid and log path are printed

#### Scenario: Child environment
- **WHEN** the child starts
- **THEN** its environment is the caller's without `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT` and `CLAUDE_CODE_SSE_PORT`, plus `DESK_HOME`

#### Scenario: Dry run
- **WHEN** `--dry-run` is given
- **THEN** the claude command line and the prompt are printed and no process starts

#### Scenario: No inherited identity
- **WHEN** the calling session has `CLAUDE_CODE_SESSION_ID` set
- **THEN** the child does not receive it, and its board claims are credited to itself

### Requirement: Stream brief
The prompt SHALL give the session its task and pipeline, and SHALL tell it to stop before `desk wt merge`.

#### Scenario: Worktree form
- **WHEN** the brief is built without `--desk`
- **THEN** it states the slug (and repo and worktree path), the task text and an optional `--todo` instruction (`desk todo start T-n --slug <slug>`)
- **AND** it gives the pipeline: create or check the worktree, delegate, `desk wt finish`, fresh `reviewer`, fixes, `verifier`

#### Scenario: Desk form
- **WHEN** `--desk` is given
- **THEN** the brief tells the session to edit the desk folder directly with no worktree or CI, post a `claim desk-<slug>`, commit each finished todo on its own and review with a fresh agent

#### Scenario: Both forms
- **WHEN** either brief is built
- **THEN** it names the handoff skill and asks for the `desk tokens 24 --session self` table in the final message

#### Scenario: Merge is not delegated
- **WHEN** a worktree stream's brief is built
- **THEN** it says to STOP before `desk wt merge`

#### Scenario: Review repo
- **WHEN** a worktree stream's repo has `merge: "review"`
- **THEN** the brief asks for the reviewer's PR findings in full in the final message, for `desk wt merge --findings`

### Requirement: Stream budget
A positive `--budget <usd>`, or a `budgetUsd: <n>` line in a `---` front matter block at the top of the
task file, SHALL be passed as `--max-budget-usd`, the flag winning; the front matter SHALL be removed
from the task text. A budget that is not a positive number SHALL fail the command. Without either there
SHALL be no budget cap.

#### Scenario: Flag wins
- **WHEN** the file says `budgetUsd: 5` and `--budget 2` is given
- **THEN** `--max-budget-usd 2` is passed

#### Scenario: Bad budget
- **WHEN** the budget is `0` or `abc`
- **THEN** the command fails with `budget must be a positive dollar amount`

### Requirement: Launching claude
On non-Windows systems the stream SHALL start `claude` detached without a shell. On Windows it SHALL
start a real `claude.exe` found by `where` detached without a shell, and otherwise (a `.cmd` shim) run
`claude` through a shell undetached. A launch error SHALL print `desk stream: cannot start claude` and
set exit code 1.

#### Scenario: Windows with an exe
- **WHEN** `where claude` lists a `.exe`
- **THEN** that file is started directly and detached

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
When git rejects the push of `wt finish` as non-fast-forward, the error SHALL say to rerun with `--rebased` (unless it already ran with `--rebased`), and SHALL in both cases say to integrate the remote commits (`git rebase origin/<branch>`) or, only if nobody else pushed to it, delete the remote branch (`git push origin --delete <branch>`), since `--rebased` never overwrites commits the branch has not seen.

#### Scenario: Amended after a push
- **WHEN** the pushed branch was amended or rebased and `wt finish` runs without `--rebased`
- **THEN** it fails with `git push failed: ... rerun with --rebased`

#### Scenario: Old remote branch of the same name
- **WHEN** a fresh worktree's branch meets a remote branch with commits it never had, with or without `--rebased`
- **THEN** the error also says to integrate them (`git rebase origin/<branch>`) or, only if nobody else pushed to it, delete the remote branch (`git push origin --delete <branch>`), and `--rebased` still does not overwrite them

### Requirement: wt merge with an unremovable worktree
When the merge is pushed but `git worktree remove` fails, `wt merge` SHALL show git's reason, SHALL still close the work and exit 0 with a warning only when git no longer lists the worktree, and SHALL otherwise keep the worktree and the claim and exit 1.

#### Scenario: Git refuses the remove
- **WHEN** `git worktree remove` fails after the merge was pushed and the worktree is still listed after a prune (modified or untracked files, a lock)
- **THEN** git's reason is shown, nothing is released and the command fails with `git worktree remove failed`, naming `desk wt remove <slug>`

#### Scenario: Folder left after git unregistered the worktree
- **WHEN** `git worktree remove` fails after the merge was pushed and the worktree is no longer listed after a prune (the folder could not be deleted, such as a shell holding it on Windows)
- **THEN** it deletes the local branch when git allows, drops the stream file, posts `release`, and prints a warning naming the folder to remove by hand
- **AND** the exit code is 0

### Requirement: wt merge current directory
`wt merge` SHALL fail with `cd out of <path> first`, before fetching or merging anything, when the current directory is inside the worktree.

#### Scenario: Current directory inside the worktree
- **WHEN** `wt merge x` runs with the current directory inside the worktree of `x`
- **THEN** it exits 1 with `cd out of <path> first` and nothing is merged or pushed

### Requirement: wt finish CI wait bound
`wt finish` SHALL stop watching CI after 30 minutes in total for all runs on the commit, so a dead runner cannot hang it.

#### Scenario: A run never finishes
- **WHEN** a run is still queued or in progress at the bound
- **THEN** `Waiting for CI (up to 30 minutes)...` was printed before the watch, the watch is stopped with `Stopped waiting with CI still running; check that the runner is up.`, the board `ci` line reads `<sha7> running`, the still-running command is printed for each open run and the exit code is 1

#### Scenario: Several runs
- **WHEN** a commit has several runs
- **THEN** each watch gets only the time left of the one 30 minute bound

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

### Requirement: wt remove under review
On a `review` repo, when `wt remove` fails because the branch is not in `origin/<default>`, the error SHALL also name `desk wt merge <slug>` as the way to close after a merge on the server.

#### Scenario: Squash-merged branch
- **WHEN** `wt remove x` runs on a `review` repo and the branch is not an ancestor of `origin/<default>`
- **THEN** nothing is removed and the error names `desk wt merge x`

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
