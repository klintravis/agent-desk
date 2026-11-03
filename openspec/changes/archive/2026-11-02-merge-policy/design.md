## Context

File and line references are to `origin/develop` at `1d1abd7`, unless a sibling branch is named.

Today `desk wt merge` runs these gates and steps (`lib/wt.mjs:143-164`):

- `:150-151` unpushed
- `:152` CI
- `:155` board verdict
- `:157-160` main checkout clean, fast-forward, push
- `:161` post `merged`
- `:162` `doneSlug`
- `:163` `remove`

The rulings fix these points, and this design does not reopen them:

- the `merge` key and its two values;
- agents may merge between agent branches, and may update their branch from the default branch;
- the PR is opened with `gh`;
- enforcement has three parts;
- the deny on `desk.config.json`.

**Goals:** both policies work per repo, and `direct` stays byte for byte what it is today.

**Non-goals:**

- A second set of gates, or a new subcommand for closing.
- A configurable list of protected branches.
- Deleting the remote branch. Today's `remove` does not do it either (`lib/wt.mjs:174-197`), and the
  server can do it on merge.
- Making the local guards a guarantee. They are not one.

## Decisions

### D1. `desk wt merge` is the one command, and it is idempotent under `review`

Adopted from the brief. The alternative, opening the PR at `desk wt finish`, fails because finish
precedes the review, so no verdict exists (`skills/orchestrate/SKILL.md:77-81`).

Under `review`, `merge` does the following after `:145-149` (worktree exists, `notInside`, fetch,
sha):

1. **Preflight.** `repo.gh` must be set and `origin` must exist; see case 2.
2. **Look up the PR.** `gh pr list --head <branch> --state all --json number,state,headRefOid,url`.
   - This form returns `[]` with exit 0 when there is no PR, checked against the private repo.
   - `gh pr view` exits non-zero for "no PR", which looks like a failed `gh`.
   - A non-zero exit from `gh pr list` stops the command; nothing falls back to a fast-forward.
   - With several PRs on the branch, it acts on the open one, else the newest.
3. **MERGED and it holds the local head:** close the work (case 1). This runs before the gates:
   CI and verdict mean nothing once a person has merged, and "delete branch on merge" would fail
   `:150-151`.
4. **CLOSED unmerged at this head:** refuse, telling the caller to add commits and get a new verdict,
   or run `desk wt discard`.
5. **OPEN and no `--findings`:** print the PR's state and URL, write nothing, exit 0. So a re-run to
   check whether the PR has merged cannot wipe the body.
6. **Otherwise,** run gates `:150-156` unchanged. No PR, or a MERGED or CLOSED PR that does not hold
   the head, leads to `gh pr create --base <default> --head <branch>`. An OPEN PR leads to
   `gh pr edit`. Then `post('note', slug, 'PR #n opened @<sha7>')` and print the URL. `--findings` is
   required here.

`:157-160` never run under `review`. No rebase or fast-forward is required, because the server handles
that and the person sees it. A later `desk wt finish` moves the PR head without changing the body, so
the body still names the older sha it was reviewed at. The docs recommend the server option that
dismisses stale approvals.

### D2. Case 1: closing after a person merged on the server

Today `remove` requires `merge-base --is-ancestor` (`lib/wt.mjs:180`) and `branch -d` (`:187`, `:193`).
Both fail after a squash or rebase merge. `doneSlug` runs only inside `merge` (`:162`).

The smallest correct close is the existing merge tail, with a different proof:

- **Proof:** PR state `MERGED`, then `git fetch origin pull/<n>/head`, then
  `merge-base --is-ancestor <local sha> FETCH_HEAD`.
  - GitHub keeps `pull/<n>/head` after the branch is deleted.
  - Ancestor, rather than equal, allows a person's "Update branch" or suggestion commits on the PR.
  - Local commits that are not in the PR fail the proof, so they are never deleted. The command goes
    on to the gates and to a new PR.
  - A person's force-push fails it too. The gates then stop on `:150-151`, and `desk wt discard` is
    the way out.
- **Close:** `post('merged', slug, 'PR #n')`, `doneSlug(slug)`, then
  `remove(c, slug, {..., afterMerge: true, merged: true})`. The new `merged` flag skips `:180` and uses
  `branch -D` at `:187` and `:193`. Existing handling of an unremovable worktree stays as is.
- **Trigger:** nothing polls.
  - The `desk status` row and the pane say `PR #n merged: desk wt merge <slug> to close`.
  - `handoff` and `kickoff` tell the session to run it.
  - `desk wt remove` on a `review` repo keeps its error and adds the same pointer.
- **The main checkout is not updated.** `desk wt new` branches from `origin/<default>`
  (`lib/wt.mjs:76-93`, `lib/config.mjs:72`), so nothing depends on it. `git pull --ff-only` stays
  allowed.

### D3. Case 2: no `gh` or no `origin`

Fail at merge, not at config load.

- `loadConfig` runs for every command. Refusing there would brick `desk status` and `desk check`, the
  commands that report the problem.
- `hasOrigin` also spawns git on each call (`lib/config.mjs:71`), too heavy for a load.
- `loadConfig` validates only the value, throwing as `kind` does at `lib/config.mjs:44`:
  - `merge` must be `direct` or `review`, so a typo can never become `direct`;
  - `review` needs `kind: git` and a non-empty `branchPrefix`, since an empty prefix would make nothing
    protected.
- `wt merge` then fails closed with `merge: review needs gh and origin on <id>; nothing was merged`.
  It never falls back to fast-forward.
- `desk check` warns about the same gap.
- `--into` needs neither `gh` nor `origin`, since it stays local.

### D4. Case 3: protected branches, and the hook's parser

**Protected = every branch outside the repo's `branchPrefix`.** This is an allow-list with no new
config key. The ruling says "never into the default branch or a release branch", and a fixed
`{default, main}` list cannot name release branches without a new key. This also handles
`agent/main` without a special case, because it is under the prefix, and `master`, `release/*`, or any
other name. False positive: a non-prefixed helper branch. Under `review` that push needs a person,
which is what the ruling asks for.

**Pure parser, in `hooks/mergeguard.mjs`:** Node-free, with `CASES` and `--self-test`, as
`hooks/editguard.mjs:20-26` and `scripts/edit-guard.mjs:9-14` do.

- Shell-word tokenizer that honours quotes, so `git commit -m "git push origin main"` passes.
- Splits on `;`, `&&`, `||`, `|`, `&` and newline. A word starting with `#` ends the segment.
- Skips leading `VAR=x`, `command` and `env`.
- Matches `git` and `git.exe` by basename.
- Reads git's global options `-C X`, `-c k=v` and `--git-dir`.
- Effective directory: `-C`, else the last `cd X` or `Set-Location X` in the chain, else the session
  directory.

| Command | Result |
|---|---|
| `git push origin agent/x`, `-u`, `--force`, `--force-with-lease` | allow: destination under the prefix; force flags change nothing |
| `git push origin agent/main` | allow: under the prefix |
| `git push origin HEAD:main`, `agent/x:main`, `+HEAD:refs/heads/main` | refuse: destination after `:`, with `+` and `refs/heads/` stripped |
| `git push origin :main`, `--delete main` | refuse: deleting a protected branch |
| `git push origin main`, `git push https://host/r.git main` | refuse: any remote, URL included |
| `git push`, `git push origin`, `git push origin HEAD` | current branch from git; detached is allowed |
| `git push --all`, `--mirror`, `--branches` | refuse |
| `git push origin refs/tags/x`, `HEAD:refs/tags/x`, `:refs/tags/x`, `--delete refs/tags/x` | allow: an explicit tag ref is not a branch (owner ruling) |
| `git push --tags`, `git push origin --tags` | allow: tags only (owner ruling) |
| `git push origin main --tags` | refuse: `main` decides; `--tags` excuses nothing listed beside it |
| `git push origin v1.2` | refuse: a bare short name cannot be told from a branch; write `refs/tags/v1.2` |
| `cd ../main && git push origin main`, `git -C ../main push origin main`, `a; git push origin main` | refuse |
| `git merge origin/main` on `agent/x` | allow: updates the agent's branch |
| `git merge agent/x` on `main` or `release/1` | refuse |
| `git merge --abort` or `--quit`, on any branch | allow |
| `gh pr merge` in a `review` repo | refuse (owner ruling) |

**Fails open:** any internal error, parse failure or unreadable config allows the command, as
`hooks/register.ts:124-129` does. What that costs, all of it stated in the docs:

- `bash -c`, `eval`, scripts and aliases (`git -c alias.x=push x`) are not seen.
- `$VAR` and `$(...)` as branch names are not resolved.
- `gh api` ref writes are not seen.
- `git push` with an upstream of another name and `push.default=upstream` looks like the current
  branch.
- Local commits on the main checkout are not stopped (their push is).
- A broken `desk.config.json` turns the guard off silently.
- Heredoc text with a line starting `git push origin main` is a false positive, seen as a command.

Only the server rule catches all of these.

### D5. Case 4: what the hook applies to

The mod does a cheap test, `/\b(push|merge)\b/`, then runs one Node script with the PreToolUse JSON on
stdin (`$.process.run`, with the path from `${$.plugin.root}`, as `hooks/pane.tsx:17`). The logic
lives in one place, in Node, and can also be wired as a settings hook, the way `scripts/edit-guard.mjs`
is. `desk sync` does not wire it, just as it does not wire edit-guard (`lib/sync.mjs:62`); sessions
without the plugin are covered only if a person wires the script.

`register.ts` adds the hook for the `Bash` and `PowerShell` tools. `register.ts:125` covers Bash only,
which on this platform would leave an open door. The existing edit guard keeps that gap; this change
does not widen its scope.

`scripts/merge-guard.mjs`:

1. `findDesk(cwd)` and `loadConfig` (`scripts/edit-guard.mjs:18`).
2. **No `review` repo: allow at once, spawning no git.** So `direct` desks, this kit's own desk among
   them, are never denied. They pay one Node start, and only on commands containing `push` or `merge`.
3. For each git command in the parse, map its directory to a repo:
   `git -C <dir> rev-parse --git-common-dir`, then `dirname(resolve(dir, out))`, compared with
   `samePath` (`lib/wt.mjs:167`, to be exported) to `repo.path`. Worktrees resolve to their main
   checkout through the common dir.
4. Unknown repo or `direct` repo: allow. On a mixed desk, only the `review` repos are refused.

The CLI spawns git itself, so `desk wt merge` and `--into` never pass through the hook.

Cost: a clone of the repo that is not the listed `path`, or a repo in another desk (`DESK_HOME` wins
in `lib/config.mjs:19`), is not recognised and is allowed.

### D6. Case 5: reading protection from the server

For each `review` repo, `desk check` reads the default branch and `main` if that differs:

1. `gh api repos/<gh>/branches/<b>`, reading `.protected`.
2. If false, `gh api repos/<gh>/rules/branches/<b>`; a non-empty list counts as protected.

| Answer | Line |
|---|---|
| protected, or rules present | `ok   <id> <b> protected on the server` |
| neither | `warn <id> <b> has no branch protection on the server; only a server rule is a guarantee` |
| 404 on the extra `main` | nothing: that branch does not exist |
| 403, no `gh`, no token, 15 s timeout | `warn <id> cannot read protection of <b>: <reason>; only a server rule is a guarantee` |

- A private repo on a free plan answers `protected: false` on the first endpoint, and 403 "Upgrade to
  GitHub Pro" on `rules/branches/<b>` and `branches/<b>/protection` (probed read-only). The second row
  or the fourth applies.
- These are `warn` lines like `bin/desk.mjs:787-788`. They never increment `bad`, so they never change
  the exit code (`:789-790`). On `direct` repos no call is made.
- The check does not judge whether the rule requires a PR, since the endpoint that says so is
  admin-only. Release branches are not discovered. The docs say which rule to set and to protect those
  too.

**The setting change flag:** `desk check` compares each repo's `merge` in the working file with
`git -C <home> show @{u}:desk.config.json` (`HEAD:` when there is no upstream) and warns on any
difference, in either direction, a removed entry included. A desk folder that is not a git repo skips
this. Once pushed, the change shows only in the desk's history.

### D7. How far the deny on `desk.config.json` reaches

`claudeSettings` adds the deny to the union at `lib/sync.mjs:56-60` when any repo is `review`. The
tracking at `lib/sync.mjs:85` removes it after switching back.

- **It stops:** Claude's file-edit tools on that file, in sessions using the synced
  `.claude/settings.local.json`.
- **It does not stop:**
  - the Bash or PowerShell tool (redirection, `sed`, `node`), although the edit guard catches the
    common scripted forms where it is active;
  - an agent removing the rule from `settings.local.json`;
  - Copilot, or a session without the synced file.
- `desk check` flags the change after the fact. The server rule is unaffected by the file, so a changed
  setting cannot merge anything on a protected server.

### D8. Case 6: the PR body

The body is built only from these, and is passed through `--body-file -` on stdin, spawned with an
argument array (`lib/wt.mjs:61` uses no shell; it needs `input` in place of an ignored stdin).

- **Verdict:** a generated line, using only the sha from the `mergeOk` match
  (`bin/desk.mjs:62-67`). The verdict's free text is dropped.
  - **Decision on T-88:** `by <model>/<effort>` (`lib/wt.mjs:247-248` on the T-88 branch) does not
    reach the PR. Which model reviewed is a per-user layer, and T-88 keeps it local. The gate still
    passes, since `mergeOk` allows trailing text.
- **Findings:** from `--findings <file>`, because board text is capped at 120 characters
  (`bin/desk.mjs:73`). The reviewer writes "No findings." when there are none.
  - It goes in a fenced block with a fence longer than its longest backtick run, so no mention,
    autolink, HTML or heading fires.
  - Over 60000 characters is refused.
  - Text matching the secret patterns is refused, not masked. Redaction restores secrets on the way
    into tool calls (`hooks/redact.ts:6`), so a findings file can hold a real one. The constants at
    `hooks/redact.ts:42,67,70` move to a Node-free `hooks/secretpatterns.mjs`, shared the way
    `hooks/editguard.mjs` is.
- **Commits:** `git log --oneline <base>..<sha>` in its own fenced block.
- **Title:** the branch's oldest commit subject, already on the server. If empty, the slug.

The body reads no user settings, no absolute desk paths and no board text other than that sha. The
skills tell the reviewer to write worktree-relative paths and no model or effort. The secret check
covers patterns only, so a host or a path inside a reviewer's own sentence is not caught; a person
reads the PR before it merges, in a repo that already has the code.

A re-run with `--findings` rewrites the whole body, so a person's notes belong in PR comments.

### D9. Case 7: stream, status, pane, sync, ownership

- **`desk stream`:** no change. Its brief already stops before merge (`lib/wt.mjs:245-247`), and the
  desk manager runs `wt merge`.
- **`desk status`:** rows at `bin/desk.mjs:485-492` gain an optional `pr`
  (`{number, state, url}`) for `review` repos only, from one
  `gh pr list --state all --limit 100 --json number,state,headRefName,url` per repo, failing to null.
  - Text rows add `PR #n open, a person merges`, `PR #n merged: desk wt merge <slug> to close`, or
    `PR #n closed unmerged`.
  - `direct` rows and root fields are unchanged, and the row schema (`additionalProperties: false`)
    gets the optional property.
  - The root `prs` stays OPEN-only (`:442-452`).
- **Desk pane:** the same text on the row at `hooks/pane.tsx:228`, and `review` on the Roots line
  (`:235`). `verdictColor` (`:119-122`) is unchanged, so a waiting PR with `MERGE` is not red.
- **`desk sync`:** after the file lines (`lib/sync.mjs:179,181`), one line per `review` repo:
  `merge   <id>: review; edits to desk.config.json denied for Claude; protect <default> on the server`.
- **Board ownership:** no new board kind.
  - Opening the PR posts a `note` and leaves the claim.
  - The session's `handoff` releases it as it does any worktree that stays open
    (`skills/handoff/SKILL.md`), so the claim shows only who is working now.
  - The open PR row on `desk status` is what marks the worktree as waiting.
  - `wt merge` has no claim gate, so any later session can close it.

### D10. `--into`

`desk wt merge <slug> --into <other-slug>`, on both policies; it does not change plain `wt merge`.

- **Gates:**
  - both worktrees exist in the same repo;
  - not inside the source (`:146`);
  - both clean;
  - the target is on `<branchPrefix><other-slug>`, since the CLI bypasses the hook;
  - neither is claimed by another live session unless `--force`, using `openClaims` as `discard` does
    (`:202-203`), because one session holds a worktree.
- **No CI or verdict gate.** The target's own `wt merge` gates apply to the combined head, by sha,
  before any of it reaches a protected branch. So a verdict given before the merge no longer passes.
- **Steps:** `git -C <target> merge --no-edit <branch>`. On conflict: `merge --abort`, then an error
  naming the files. The agent resolves it by hand in the target (the hook allows it); a re-run sees the
  source as an ancestor and goes straight to the close.
- **Close:** `post('merged', slug, 'into <branch>')`, `doneSlug`, `remove` with `merged: true` after
  checking the source is an ancestor of the target.
- `--findings` with `--into` is an error.

A plain `git merge` in the target also works, but it strands the source's worktree, claim and todo,
which is why the flag exists.

### D11. Case 8: rebase notes for T-86 and T-88

Implement after both. Neither shares a requirement header with this change: both MODIFY `Dispatch` and
T-88 MODIFIES `Status JSON`, and this change touches neither. Everything here is ADDED except
`wt merge`.

**T-88 (user settings):**

- Rebase conflicts are likely in `lib/config.mjs` (resolver next to the repo map), `lib/sync.mjs`,
  `bin/desk.mjs` (status rows, check lines), both schemas, `types/index.d.ts`, and
  `skills/orchestrate`, `skills/handoff`.
- **A user file can never switch this policy.** `merge` is read only from the `repos[]` of the
  committed `desk.config.json` (`lib/config.mjs:41-47`). The T-88 resolver must not cover it; a test
  covers it.

**T-86 (`desk tidy`):**

- Rebase conflicts in `bin/desk.mjs` dispatch, `skills/handoff`, `skills/kickoff`, `templates/AGENTS.md`.
- `lib/tidy.mjs` does not remove worktrees. `orphans` (`:55`) only handles stream and scratch files and
  skips any slug with a worktree or an open todo, so an open PR's worktree is out of its reach.
- `owners` (`:35`) may clear a dead session's `owner` after handoff, which is harmless: the todo stays
  open and any session may close it.
- `candidates` (`:74`) may raise a PR waiting over 14 days without a claim as a stale question to the
  owner. That is a question only, and accurate. No change needed.
- `merged` is still posted on close, so its `finished` rule keeps working.

## Risks / Trade-offs

- Local guards can be walked around (D4, D7) → the docs say that only the server rule is a guarantee,
  and `desk check` warns when it is missing.
- A free-plan private repo cannot have protection (D6) → the warning stays on permanently there, which
  is true and does not fail the check.
- The PR body can go stale after a later push (D1) → it names its sha, and the docs recommend
  dismissing stale approvals.
- The close needs someone to re-run `wt merge` (D2) → status, pane and skills say so. A forgotten close
  costs only a leftover worktree.
- Secret patterns are not exhaustive (D8) → the refusal is a net, not a proof.

## Migration Plan

None for existing desks: the key is absent, so `direct`. To turn it on: set `merge: "review"`, set up
`gh` and `origin`, run `desk sync`, protect the branches on the server, run `desk check`. To turn it
off: reverse the key, then `desk sync` removes the deny.

## Decided by the owner

The proposal's three open questions, ruled on T-92:

1. **The hook refuses `gh pr merge` on a `review` repo.** It does exactly what the ruling forbids for
   `git push` and `git merge`.
2. **Agent tag pushes are allowed:** `refs/tags/*` and `--tags` pass. A bare short name, as in
   `git push origin v1.2`, cannot be told from a branch in a refspec and stays refused; the agent writes
   `refs/tags/v1.2`. A tag on the server is therefore not a person's act under `review`; a repo that
   wants that sets a server rule.
3. **`--into` closes the source's todo,** with `merged` naming the target, so one todo remains for one
   worktree.
