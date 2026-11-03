Implement after T-86 and T-88 have merged; see `design.md` D11 for what needs a rebase.

## 1. Config

- [x] 1.1 `lib/config.mjs`: default `merge: 'direct'` in the repo map; throw on a value other than `direct` or `review`, on `review` with `kind: folder`, and on `review` with an empty `branchPrefix`, and on `review` with a `defaultBranch` inside the `branchPrefix`
- [x] 1.2 `schemas/desk-config.schema.json` and `types/index.d.ts`: add `merge`

## 2. wt merge

- [x] 2.1 `lib/wt.mjs`: `gh` helper takes optional stdin; add `into` and `findings` to `WT_FLAGS` and the usage line
- [x] 2.2 `merge`: under `review`, preflight, PR lookup, the state table in D1, gates unchanged, `gh pr create` or `gh pr edit`, `note` on the board; `:157-160` not reached
- [x] 2.3 The close: proof through `pull/<n>/head`, `post('merged')`, `doneSlug`, `remove` with `merged: true` (skips the ancestor check, uses `branch -D`)
- [x] 2.4 PR body builder (pure, exported): sha only from the verdict, fenced findings and commits, size cap, secret refusal
- [x] 2.5 Move the secret patterns from `hooks/redact.ts` to Node-free `hooks/secretpatterns.mjs`, used by both
- [x] 2.6 `--into`: gates, merge, conflict abort, close (D10)
- [x] 2.7 `remove` on a `review` repo: error adds the pointer to `desk wt merge`

## 3. Merge guard

- [x] 3.1 `hooks/mergeguard.mjs`: pure, Node-free parser and verdict with a `CASES` table (D4)
- [x] 3.2 `scripts/merge-guard.mjs`: PreToolUse JSON on stdin, `--self-test`, desk and repo mapping (D5), fails open; export `samePath`
- [x] 3.3 `hooks/register.ts`: `tool.call` hooks for `Bash` and `PowerShell`, cheap word test first, then the script; fails open

## 4. Check, sync, status, pane

- [x] 4.1 `bin/desk.mjs` `check`: protection lines (D6), setting change flag, `gh` and `origin` gap; warnings only
- [x] 4.2 `lib/sync.mjs`: deny on the desk's `desk.config.json` when any repo is `review`; confirm the absolute-path form of the permission rule on Windows against the permission docs and cover it with a test; output line per `review` repo
- [x] 4.3 `bin/desk.mjs` status: optional `pr` on `review` rows, text rows; `schemas/desk-status.schema.json`
- [x] 4.4 `hooks/pane.tsx`: same row text, `review` on the Roots line

## 5. Skills, docs

- [x] 5.1 `skills/orchestrate` Merge step, `skills/handoff`, `skills/kickoff`, `templates/AGENTS.md`, `agents/reviewer.md`: under `review` write findings to a scratch file (worktree-relative paths, no model or effort), run `desk wt merge <slug> --findings <file>`, stop for a person, close by re-running it
- [x] 5.2 `README.md`: Worktree flow, Config reference, the guard; which server rule to set, the deny's reach, and that **only the server rule is a guarantee**
- [x] 5.3 `CHANGELOG.md` and `openspec/inventory.md`: the key, the flags, the hook, the new files

## 6. Tests (temp dirs only, `gh` stubbed, never the real desk or network)

- [x] 6.1 **`direct` unchanged, first.** With the key absent and with `merge: "direct"`: `wt merge` gates, fast-forward and close as today; `desk sync` writes no deny and no new line; `desk status --json` rows have no `pr`; `desk check` makes no `gh api` call and prints no new line; `merge-guard` allows `git push origin main` and `git merge` and spawns no git
- [x] 6.2 Config: bad value throws; `review` on a folder throws; `review` with an empty prefix throws
- [x] 6.3 A user-layer file holding `merge` or `repos` changes nothing: `loadConfig`, guard and `wt merge` stay as committed (needs T-88)
- [x] 6.4 `wt merge` under `review`: each gate refuses on its own; all pass opens the PR; the default branch and the main checkout do not move and nothing is pushed to the default branch; re-run updates the body
- [x] 6.5 No `gh` value, no `origin`, `gh` missing, `gh` failing: clear message, exit 1, never a fast-forward
- [x] 6.6 Close: squash, rebase, merge, and "Update branch" on top; branch deleted on the server; local commits not in the PR are not closed and go on to a new PR; closed unmerged refused; open with no `--findings` writes nothing
- [x] 6.7 `wt remove` under `review` on an unmerged branch adds the pointer and removes nothing
- [x] 6.8 `--into`: clean merge closes the source and leaves the target's head changed; conflict aborts and leaves both as they were; re-run after a hand merge closes; dirty target, wrong branch in the target, claim by another session (and `--force`), different repo; on `direct` too; `--findings` with `--into` refused
- [x] 6.9 Guard `CASES`: every row of the D4 table, with quoted text, comments and `env` prefixes, through `--self-test`
- [x] 6.10 Guard mapping: worktree resolves to its repo; mixed desk refuses only on the `review` repo; unknown repo, broken config and a failing git all allow
- [x] 6.11 Protection check: protected, rules only, none, 403, 404 on `main`, no `gh`, timeout; exit code never changes
- [x] 6.12 Setting change flag: change either way, removed entry, no upstream, desk not in git
- [x] 6.13 PR body: findings holding backticks, `@name`, `#1`, HTML stay inside the fence; a verdict with `by <model>/<effort>` leaves no trace of it; secret refused; oversize refused
- [x] 6.14 Sync: deny added on `review`, removed after switching back, the user's own permissions kept
- [x] 6.15 Status JSON validates against the schema with `pr`; `gh` failure leaves the row and exit 0; pane row shows each state
- [x] 6.16 Run `npm test && claude plugin test && claude plugin validate .`
