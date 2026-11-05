# Changelog

agent-desk follows [Semantic Versioning](https://semver.org). One version covers the `desk` CLI and
the Claude plugin (`package.json`, `.claude-plugin/plugin.json` and `vscode/package.json` always agree). Each entry says
what an existing desk must do on upgrade; `desk check` warns while `kitVersion` in
`desk.config.json` differs from the kit installed in the desk's `node_modules`.

## Unreleased

- Added: approach skills `fix` (corrections: reproduce, a failing-before test committed first, root cause fixed once in shared code; Ponytail at its tightest) and `refactor` (intentional restructures, deliberately aggressive: pin behaviour, plan the target shape, subtract first, script repeated edits, migrate every caller and delete the old path in one branch, prove the pinned tests pass unedited and report the net reduction; it replaces Ponytail's smallest-diff and keep-the-structure rules for that run). The `orchestrate` skill gains an Approach by kind table (fix, feature, refactor, perf, docs) that picks the approach, the task id, what is validated and whether the structure pass runs; `structure-reviewer` gains a plan mode that returns a refactor's target shape for given paths. Adapted from pstack's bug-fix and refactoring playbooks (MIT). Nothing to do.
- Added: skill `validate` and agent `validator` (sonnet, medium) with task id `validate`. Todos carry acceptance claims as notes, `accept: <claim> | <command> | <expected>`, written at kickoff; after `desk wt finish` the validator reruns each claim on the base and the head beside the reviewer and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE. It posts no verdict; the orchestrator treats NOT VERIFIED as a must-fix finding and merges only when every claim is VERIFIED. The implementer runs the `accept:` commands before it reports. Adapted from Cursor's `verify-this` (MIT). On upgrade, to tell agents in an existing desk about the refactor override, copy the Ponytail line of `templates/agent-rules.md` into the desk's `agent-rules.md`; `desk sync` does not rewrite it.
- Changed: cheaper defaults in the `orchestrate` table, for lower plan usage: `fix-verify` runs on `sonnet` (was `opus`), `debug` at `medium` effort (was `high`), `review-sensitive` at `high` (was `xhigh`) and now also covers code built as `implement-hard`. The table stops at `high`; `xhigh` and `max` only when the user asks. The `verifier` agent's own model is `sonnet`. The `reviewer` reruns the repo's check only when CI for the head is not green. `review`, `implement-hard`, `propose` and `memo` stay `opus`/`high`. To keep a previous value, set it under `tasks` in `desk.config.json` (or `floor` to hold it for everyone), for example `"floor": { "review-sensitive": { "effort": "xhigh" } }`.
- Added: skill `stack-lens`, one short file per stack (`typescript`, `testing`, `state`, `perf`, `security`, `ui`), each with a Build half for the `implementer` and a Review half for the `reviewer`. The `orchestrate` skill names the lenses in each brief and the agent reads only those. Adapted from Lauren Tan's pstack and Cursor's cursor-team-kit and thermos plugins (MIT). Nothing to do.
- Added: agent `structure-reviewer` (opus, medium, read-only) and the vendored skill `thermo-nuclear-code-quality-review` from Cursor's thermos plugin (MIT). It reviews structure (code-judo simplifications, spaghetti branching, files pushed past 1000 lines, wrong layer) beside the `reviewer` on changes over about 300 lines and on refactors, and posts no verdict: its blockers join the reviewer's findings for one fix round, so the merge gate is unchanged. Nothing to do.
- Added: `orchestrate` task ids `implement-perf` (sonnet, high), `refactor` (sonnet, medium) and `review-structure` (opus, medium); `desk settings` and the user settings file accept them. Nothing to do.
- Changed: the `implementer` names the data shape first, keeps files under 1000 lines, writes a failing test before a bug fix where a cheap one exists, and removes slop from its own diff before committing. The `reviewer` also flags devex breaks (env vars, ports, secrets, new setup steps), feature-gate leaks and new files over 1000 lines, reads the other side before reporting, and reads a PR's threads only after its own pass. Nothing to do.

## 0.6.0 - 2026-11-03

- Added: each GitHub release carries the VS Code extension as `agent-desk-vX.Y.Z.vsix`; install it with `code --install-extension agent-desk-vX.Y.Z.vsix`. Nothing to do if you do not use it.
- Changed: the `sk-` secret shape needs a digit within 100 characters, so sentences such as `risk-based-rollout-for-every-branch` are no longer masked; a digit-free key is not caught. Nothing to do.
- Changed: the Desk pane and the VS Code extension now show the same three panels, Decisions, Work and Todos, in that order, with nothing shown twice. The pane's tabs were Work, Branches and Sessions, with decisions above them; Tokens and Roots are now rows above the tabs, and an active todo on a branch or claim shows only in Work (an open PR is said on the Pull requests card, not again on its branch row). Work lists its sections in one order in both surfaces, branches most urgent first, and the extension gains the Pull requests section. The extension's one view becomes three collapsible views. **BREAKING:** a keybinding or `when` clause on `agentDesk.status` must name `agentDesk.decisions`, `agentDesk.work` or `agentDesk.todos`. Added `todos` to `desk status --json` and its schema (`v` stays 2): open, active and blocked todos not in Work, without area `owner` and without area `idea` unless active, active first, then by priority. Printed `desk status` is unchanged. **BREAKING:** a script that validates the JSON against the schema must accept `todos`. **BREAKING:** update the desk's agent-desk together with the extension: the extension refuses a status with no `todos` and says to update whichever is older. Real differences between the surfaces are stated in `openspec/specs/plugin-ui/spec.md`, Panels in both surfaces.
- Added: owner decisions can carry real options. `desk todo add ... --option "<label>: <why>"` (repeatable, 2-4, labels up to 60 characters, recommendation first) stores `options`, with `--why` as the question's context; `desk decide --json` and `decisions[].options` in `desk status --json` (`v` stays 2) give them to readers; the Desk pane reads that JSON and shows each why in the dialog text, and the VS Code extension's Decide picker shows it as the row's detail. Choosing an option records its short label only. Typed `/decide` with no arguments now opens that same dialog when the next decision has 2 to 4 options (it only printed text before; text remains with none waiting, with other option counts, and where no dialog is possible, as in `-p`). If `/decide` is not in your slash menu, as seen in VS Code, use the new `decide` skill (plugin skills are listed namespaced, so `/agent-desk:decide`), which walks the decisions with AskUserQuestion, each why as the option's description. `desk decide T-n --pick <n>` records the nth option's label, so a label crosses no shell, and `desk decide` now refuses a ruling shaped like a secret, recording nothing. Old todos with only `--why` still display, split on `;`. The skills, `desk wt` prompts and the desk template now tell agents to write `--option`; on upgrade, update the `--why "<recommended>; <other>"` line in your desk's own `AGENTS.md` by hand, since `desk sync` does not rewrite it. **BREAKING:** a plugin or extension from this version needs a desk CLI from this version too: an older one refuses `desk decide --json` and records nothing.
- Docs: the merge guard's not-covered list (README, `hooks/mergeguard.mjs`) names PowerShell hashtable values whose key is only a `$(...)`, sits in parentheses, or has no `$` (`@{ "x" = git push origin main }`) and `GH_REPO=o/a env GH_REPO+=b gh pr merge 1`. No guard change. Nothing to do.
- Changed: `desk status --json` gives every branch a `state` word (`ready`, `needs review`, `rebase`, `fixes needed`, `CI failed`, `CI running`, `CI stale`, `no CI yet`, `CI unknown`) computed in the CLI by the rule `desk wt merge` uses, plus `verdictOld`. The Desk pane and the VS Code sidebar read it and no longer parse CI and verdict text, so a branch with a failed second CI run is no longer shown ready. In the pane, `MERGE AFTER FIXES` turns from orange to red and a `neutral` run from orange `CI unknown` to red `CI failed`. **BREAKING:** update the desk's agent-desk together with the plugin and the extension (a plugin or extension from this version on an older CLI does not work); a script that validates the JSON against the schema must accept the new fields.
- Changed: the session context, the `desk init` hint, the desk `AGENTS.md` template and the skills give PowerShell and cmd users the direct node form (`$env:DESK_HOME = '<desk>'; node '<desk>\node_modules\agent-desk\bin\desk.mjs' ...`) in place of `desk.cmd`, which some machines block; the README says so. `desk.cmd` is still written and still works. Nothing to do; an existing desk's `AGENTS.md` keeps its old text unless you copy the new lines from `templates/AGENTS.md`.
- Added: `scripts/gh-review-live.mjs` and a release step in the README: a live test of the merge `review` path's `gh` calls on a throwaway PR in the private repo (list, create, update, server merge, close proof, cleanup). Developer only; nothing to do.
- Fixed: `desk status` no longer fills a branch's PR review row (comments, unresolved threads, decision) from an open fork PR with the same branch name. Nothing to do.
- Fixed: `desk status` names `desk wt merge <slug> to close` for a merged PR only when the PR holds the branch's head (its head, or a commit on top of it); otherwise (a new commit, a reused slug) it says `PR #n merged`, and `--json` marks the `pr` with `stale: true`. Nothing to do.
- Changed: the VS Code sidebar shows one `Work` row per piece of work (todos, branch and claim joined on the slug) with a colour icon, in place of `Active todos`, `Branches` and `Claims`; it gains a `Running sessions` section with title and agent count (`unavailable` when unreadable), and empty sections are hidden.
- Fixed: the merge guard reads a push hidden by bash `$'...'` escapes (`git pu$'\x73'h origin main`) and the PowerShell assignment forms `$a += git push origin main`, `$a=$b=git push origin main` and `$a, $b = git push origin main`, and `$a –= git push origin main`, `` echo `git pu\\sh origin main` ``, `echo $$'\'; git push origin main #'`, `a[0]=x git push origin main`, `coproc git push origin main` and `GH_REPO+=o/a gh pr merge 1`. Nothing to do.
- Changed: the merge guard refuses a line it cannot read that names `push` or `merge`, or has a backslash after `$'` (a quote it reads as unterminated, as in `echo ${x:-'}'}; git push origin main`) on any desk with a `review` repo, where it allowed it before. A line it misreads but can read is judged as read, so the README's not-covered list still names such misses. Its other errors still allow. If a line you meant is refused, write the command plainly.

## 0.5.0 - 2026-11-03

- Changed: the `orchestrate` skill runs one `implementer` per code task group (in order, same worktree, each committing) for a change over about 150 lines. Nothing to do.
- Added: `desk wt rebase <slug> [--no-wait]` fetches and rebases the branch on `origin/<defaultBranch>`, pushes it like `wt finish --rebased` (check, CI wait), and runs `git range-diff` against the commit of the slug's newest board verdict, reporting whether only context changed. It posts no verdict; the merge gate is unchanged. A conflict aborts the rebase. Nothing to do on upgrade.
- Fixed: `desk tokens` and the token figures in `desk status` undercounted compacted runs: a compaction's zero-usage copy of a call overwrote its real count (42% of subagent fresh tokens over 48h on this desk). Figures rise after the upgrade. Nothing to do.
- Added: `desk tokens` shows each run's depth and parent, with two lines before the total: first-call share, cache reads per call, nested runs, and warm starts by the gap since the last spawn of an agent type and model. `--json` rows gain `depth`, `parent`, `firstFresh`, `firstRead` and `sinceSpawn`. Nothing to do.
- Fixed: `desk tokens` counted subagent calls several times over (the client's `<synthetic>` assistant lines were one call each; one reviewer showed 511 calls for 79 real ones); they are now skipped. Nothing to do.
- Changed: `npm test` discovers `test/*.test.mjs` (through `scripts/test.mjs`) instead of a file list in `package.json`. Nothing to do.
- Added: CI runs `claude plugin test` on Node 22, with a pinned Claude Code CLI installed under the job's temp folder (developer only; no API key). Nothing to do.
- Added: skill `walkthrough` walks the owner through the open `watch` todos about the Desk pane, one check at a time, and records each `pass` or `fail` on its todo. Nothing to do on upgrade.
- Added: `desk tidy` reports stray worktree folders: a folder in the worktrees folder that a configured repo's worktree
  prefix names but `git worktree list` does not. They show in a new text section and as `strayFolders` in `--json`.
  Tidy never deletes or moves them, with or without `--apply`. Nothing to do on upgrade.
- Added: per-repo `copy` in `desk.config.json`, a list of relative paths (for example `.claude-plugin/types`) that `desk wt new` copies from the repo's main checkout into the new worktree before `install` and `build`, so gitignored, machine-local files reach it. A missing path is skipped; an absolute path or one with `..` is refused. Optional; nothing to do on upgrade.

## 0.4.0 - 2026-11-02

- Added: per-repo `merge: "direct" | "review"` in `desk.config.json` (default `direct`, today's behaviour; nothing to do
  on upgrade). Under `review`, `desk wt merge <slug> --findings <file>` keeps its gates and opens or updates a pull
  request instead of merging; after a person merges on the server, re-running it closes the work. New
  `desk wt merge <slug> --into <other-slug>` merges between agent branches (both policies). New merge guard
  (`hooks/mergeguard.mjs`, `scripts/merge-guard.mjs`) refuses agent pushes and merges to protected branches;
  `desk sync` denies the edit tools on `desk.config.json`; `desk check` warns about missing server protection and a
  changed setting; `desk status` and the Desk pane show the PR state. **Only a server branch-protection rule is a
  guarantee**; the guard and the deny are best effort. The review path is tested against a `gh` stub and has not met a
  real server: try it on a throwaway pull request before relying on it.
- Changed: the Desk pane says what is working on what. Its Desk tab is now `Sessions <n>`: each session by its transcript
  title, with worktree, id and agents, the agent types without the plugin prefix (`implementer/medium`, no longer
  `agent-desk`). Open branches are one row each with one state word, most urgent first; overlaps are grouped by file,
  the top three and `+N more`; a line above the tabs counts what waits; Cache and Style share a row.
  **BREAKING:** `desk status --json` is now `v: 2`: a session gains `title` and `slug`, and `agents` changes from strings
  to `{type, about}`, so a script reading `agents` must follow. `desk tokens --json` rows gain `title`, `type` and `about`. `desk status` lists sessions the same way. Nothing else to do on upgrade.
- Added: `.gitattributes` sets `CHANGELOG.md merge=union`, so parallel branches adding entries at the same spot merge
  and rebase without a conflict (developer only). Union keeps both sides' lines, so read the result. Nothing to do on
  upgrade.
- Changed: the `orchestrate` skill and the `implementer` agent spend fewer tokens. Briefs point to todos, specs and files
  instead of pasting them; a proposal reads what its brief names and stops at about 40 tool calls; reports run about 20
  lines plus the raw verify output; the orchestrator reads the proposal and its open questions, not every artifact.
  Nothing to do on upgrade.
- Added: agent `scribe` (haiku, low effort) writes a branch's CHANGELOG entry, `openspec/inventory.md` rows and README
  command-table rows from its diff, edits nothing else and hands explanatory prose back unwritten. The `orchestrate`
  table routes those docs to it; compare its first few runs against Sonnet. `desk sync` writes it for Copilot. A desk's
  own `AGENTS.md` keeps its old agent list until edited by hand; nothing else to do on upgrade.
- Added: `desk tidy [--apply] [--json]` reports what finished work left behind. `--apply` clears the `owner` of proved-dead
  sessions, deletes proved orphan stream files and scratch logs for good, and raises one `owner` todo for todos that look
  finished, stale or forgotten; it never closes a todo. The `handoff` skill runs `--apply` and `kickoff` reads the report.
  Nothing to do on upgrade: `desk sync` copies the skills for Copilot. The first `--apply` may clear several owners and
  raise one owner todo. An existing desk keeps its `AGENTS.md`, so add `tidy` to the command list there by hand.
- Added: `scripts/docs-check.mjs [<checkout>]` compares the README (links, Node version, Commands table with its actions
  and flags) and `openspec/inventory.md` with the code; `npm test` runs it. No action on upgrade.
- Added: the read-only `ci-triage` agent (Haiku, low effort) takes a red CI run and returns the failing step, the failing
  test and the first error, and fixes nothing. The `orchestrate` skill sends CI logs to it; a long local check output
  stays with `general-purpose`. On upgrade: run `desk sync` in a desk with the `copilot` harness to get its
  `.github/agents/ci-triage.agent.md`.
- Added: per-user model, effort and cache choices in `~/.agent-desk/settings.json` (`AGENT_DESK_SETTINGS` overrides the
  path), and `desk settings [--json]` to show each resolved value and its source. `desk sync` writes user cache keys to
  git-ignored `.claude/settings.local.json` only; nothing from the file reaches a committed file, and removing a key from
  it never touches a file git tracks. `.claude/synced-permissions.json` gains `user`, the names of those keys. `desk status`
  and `desk check` show an active user layer. Nothing to do on upgrade.
- Added: `tasks` and `floor` in `desk.config.json`: a desk's values per task id, and minimums that only raise. Nothing to
  do on upgrade.
- Changed: `reviewer` and `verifier` post `<VERDICT> @<sha> by <model>/<effort>`. The merge gate reads verdicts as before,
  and `desk status --json` keeps 120 characters of a verdict, not 60. Handoff quotes verdicts in a todo without the `by`
  part. The record reaches only people who can read that desk's board. Nothing to do on upgrade.
- Changed: the `orchestrate` table's architecture memo row now says `opus` instead of "the strongest model". Set `memo` to
  `fable` in your user file if you want Fable there.
- Changed: Desk pane colour follows attention. Quota takes Context's colours, Warm's reason turns orange while off, ids
  and slugs take one accent, a todo's `next:` is no longer dim, pull request rows are statuses, the Open branches, Pull
  requests and Overlaps cards take the border of their worst status, and the Branches tab shows a red dot while one is
  red. Nothing to do on upgrade.
- Changed: the `NEXT.md` migration prints each todo it moves to `watch` and the command that moves it back, since an
  item can name a todo it only cites. Nothing to do on upgrade.
- Added: `npm run typecheck` type-checks `hooks/` and their tests (strict plus `noUncheckedIndexedAccess`) against the
  engine types (developer only). Nothing to do on upgrade.
- Added: `desk tokens --by-worktree` prints one row per worktree (calls, fresh, output, cache share); every
  `desk tokens --json` row gains a `worktree` field. Nothing to do on upgrade.
- Fixed: the `archiver` agent and the `orchestrate` skill called spec close-out post-merge; a spec change is archived
  inside its change branch, before merge. Nothing to do on upgrade.
- Fixed: `desk status --watch` printed `CTX>250k:` once per session and agent label, so a relaunched agent with the same
  label stayed silent. It is now once per agent run (its transcript file). New `ctx` board notes start with
  `[<file name>] `; older notes match nothing and make no past agent announce again (bar an old agent that drops
  below 250k and crosses again: once more). Nothing to do on upgrade.
- Fixed: the `NEXT.md` migration in `desk sync` no longer adds a duplicate `watch` todo for a "Not yet verified live" item that names one open todo (`T-n`): it moves that todo to area `watch`. An item naming a done, dropped, missing, `owner` or `idea` todo, or several ids, still adds a new `watch` todo. Nothing to do on upgrade.
- Added: an optional todo `summary` (`desk todo add|set --summary "<about 50 characters>"`, cut to 60). The Desk pane
  shows each active todo as an id row (id and summary, the title when none), then `state:` and `next:`, each cut to
  one row at the edge (the full text stays in `desk todo show`), with one label on the id row: `wt:<slug>`, else the owner (the summary is cut first; model, area, size and priority are not shown there). `desk status --json` carries `summary`. Nothing to do on upgrade; existing todos need no field.
- Fixed: `desk wt finish` no longer hangs when CI never finishes (a dead runner): it stops watching after 30 minutes
  for all runs together, reports CI `running` and exits 1. Nothing to do on upgrade.
- Fixed: a `Decide T-n` press did nothing, since the engine's command chain skips the plugin's own `/decide` hook. A
  press now asks each waiting decision in a dialog, records the answer after redaction, on one line, cut to 1000 characters, and goes on to the next. A decision with
  fewer than 2 or more than 4 options keeps the toast and the `/decide T-n ` fill. Typed `/decide` and `desk decide` do
  not change. Nothing to do on upgrade.
- Desk pane: the raw status text is gone. Owner decisions stay above three tabs (Work, Branches, Desk), every
  status field is on a tab, and CI and verdicts are coloured; green only for a result on the branch head.
  Nothing to do on upgrade.

## 0.3.0 - 2026-11-01

- agent-desk is public at `github:klintravis/agent-desk`. CI uses hosted Linux, Windows and macOS on a public repo and a self-hosted runner on a private one; the release workflow runs only on a public repo. The public history starts at this release: older versions below have no public tag. Nothing to do on upgrade, and no read access is needed to install.
- Todo area `idea` holds quick thoughts that are not work yet: `todo next` and the plain `todo list` skip them; `--area idea` and `todo list --all` show them; `todo set T-n --area <repo id>` promotes one. `todo list` now also shows an open todo whose parent it does not show (other area, or closed) at the top level. On upgrade, copy the `idea` sentence from `templates/AGENTS.md` into the desk's `AGENTS.md`; `desk sync` does not add it.
- Fixed: the band's and the pane's decide Button (now `Decide T-n`) also fills an empty prompt with `/decide T-n ` for the decision it printed, so the owner types only the ruling; before, a press only printed the question. Nothing to do on upgrade.
- Fixed: in the VS Code extension and the desktop app the Desk pane, `/desk`, `/decide` and the refresh loop now start when the editor attaches (those sessions are not interactive at start). Nothing to do on upgrade.
- The status line is `ctx <bar> % · 5h <bar> % · warm auto|off · ⚑ n` (the last two in a desk); cache and quota detail moved to the Desk pane.
- The band above the prompt shows `⚑ n decisions waiting` with a `Decide T-n` button, and a near-full context row in any session.
- The Desk pane has rows: Context, Quota, Cache, Style, Warm, Agents, Trees, Decide, above the `desk status` text.
- Keep-warm can be toggled `auto` / `off` from the pane's Warm row, for the session only.
- `desk status --json` prints the status as one object, described by `schemas/desk-status.schema.json`; the pane reads it. Nothing to do on upgrade.

- `desk sync` and `desk workspace` hide the kit's plumbing (`desk`, `desk.cmd`, `node_modules`, `package.json`,
  `.github`, `.claude`, ...) in VS Code through `files.exclude` in the desk folder's `.vscode/settings.json`.
  Your keys and any exclude you set (`false` included) stay. Nothing to do on upgrade; add `.vscode/` to an
  existing desk's `.gitignore` if you do not want to commit it (new desks get it).
- `NEXT.md` and `TODO.md` are gone. Rulings live in `decisions.jsonl` (`desk decide T-n` appends one,
  `desk decide --list [n]` prints them); what waits to be verified live is a todo with area `watch`
  (`desk todo next` skips it like `owner`); default-branch shas are on `desk status`'s Roots lines;
  `desk todo md` is removed. Every line the CLI writes carries `"v": 1`, the kit ships JSON Schemas of
  the desk files in `schemas/`, and `desk check` warns about a line that breaks one (exit code unchanged).
  **On upgrade:** run `desk sync` once. It migrates `NEXT.md` (rulings to `decisions.jsonl`, "Not yet
  verified live" to `watch` todos, the file renamed `NEXT.md.bak`; it names the sections it left there,
  such as Work), deletes a generated `TODO.md`, and patches the shipped `AGENTS.md` lines that named
  them. Edit by hand the lines it names, move anything you still need out of `NEXT.md.bak`, then commit.
  It is idempotent; a sync of named repos only does not migrate.

- `desk status --watch`: `CTX>250k:` printed again when an agent's peak fell below 250k (its transcript pruned or compacted) and crossed again.
  It now prints once ever per session and agent (a board note on slug `ctx` marks it, like `OWNER+:`).
  Nothing to do on upgrade.

- `desk status` (and the Desk pane): an open branch that lacks commits of its repo's default branch now
  says `behind <default> by N, rebase`, so a fast-forward-only `wt merge` is no surprise. It compares with
  `origin/<default>` as last fetched (no network call), or the local default branch without an origin;
  nothing is shown at 0. Nothing to do on upgrade.
- Fix: `desk init` wrote into the folder `DESK_HOME` named instead of the current folder, so running it
  from a session inside another desk changed that desk. It now always uses the current folder. Nothing to
  do on upgrade; a script that used `DESK_HOME` to aim `init` must `cd` to the new desk first.
- Fix: `desk wt discard` run from a shell inside the worktree left the folder and the board claim behind on
  Windows. `wt discard`, `wt remove` and `wt merge` now exit 1 with `cd out of <path> first` before changing
  anything; `wt discard` and `wt remove` also finish (with a warning) when git unregistered the worktree but the folder
  stayed. Nothing to do on upgrade.
- Fix: secret redaction hid template text in source as a connection-string password
  (`` `postgres://${user}:${pass}@${host}` `` reached the model with `${pass}` replaced), so the model saw
  mangled code. A password that is exactly one placeholder is now kept: `${...}` or `{{...}}` holding a
  bare name or dotted path, no default value. Any other password, including a placeholder with a default
  value (`${P:-pw}`), one that only contains `$` or a placeholder among other text, is still hidden.
  `<...>` (`<password>`, `<SuperSecret>`) is not exempted because a real password can be written in
  angle brackets; `$VAR` and `%VAR%` are not because `$ecret99` and `%ecret99%` are real passwords. Nothing to do on upgrade.

## 0.2.0 - 2026-11-01

- Fix: `desk home` exited 0 for a `DESK_HOME` folder without `desk.config.json`, so the plugin pane turned
  on outside a desk. It now exits 1. Nothing to do on upgrade; fix a stale `DESK_HOME` if the pane disappears.
- Fix: `desk wt ...` and `desk stream` ignored unknown flags and a value flag at the end of the arguments
  (`--repo` alone became `undefined`), and each accepted the other's flags (`wt discard x --dry-run` ran for
  real). Each now takes only its own flags and exits 1 with an error otherwise. On upgrade, remove typo flags from scripts.
- Fix: `desk wt finish` after a rebase or amend said only "git push failed"; it now says to rerun with
  `--rebased`. Nothing to do on upgrade.
- Fix: `desk wt merge` left the branch and the board claim behind when `git worktree remove` failed (a
  shell holding the folder on Windows). When git has already unregistered the worktree it now closes the
  merge, warns which folder to remove by hand and exits 0. When git refuses (modified or untracked files, a
  lock) it shows git's reason, keeps the worktree and the claim and exits 1. Nothing to do on upgrade.
- Release process: `node scripts/release.mjs bump <x.y.z>` sets the version in `package.json` and
  `.claude-plugin/plugin.json` and files the Unreleased entries under it; `notes <tag>` prints a
  version's entries. Pushing a tag `v*` runs `.github/workflows/release.yml`, which checks the commit is
  on `main` and creates the GitHub release. `npm test` now also checks that the two versions agree.
  Nothing to do on upgrade.
- New skill `kickoff` (start of the day, the counterpart of `handoff`): gathers the desk's live state,
  finds the work, plans the first 3-6 todos into `todo.jsonl`, shows the owner the plan and continues
  with `orchestrate` on go. `desk sync` copies it for Copilot. New desks' `AGENTS.md` mentions it;
  existing desks may add "or run the `kickoff` skill to plan the day" to theirs.
- New config key `outputStyle` (default `"Concise"`): `desk sync` writes it into every
  `.claude/settings.local.json`, so main and `desk stream` sessions run in that output style, and
  subagents get a one-line "reply concisely" rule. `""` turns it off (the next sync removes the key an earlier sync wrote).
  On upgrade run `desk sync`; set `"outputStyle": ""` to keep the old behaviour.
- Fix: `todo add --prio abc` now exits 1 with an error and writes nothing (it stored `null`), and
  `--` ends the flags so a title can start with `--` (`todo add -- "--foo"`). A flag with no value, or
  whose value starts with `--` (`--all` takes none), now also exits 1 and writes nothing. Nothing to do on upgrade.
- Docs: the kit's behaviour is now specified in `openspec/specs` (one
  capability per folder, in requirement and scenario form), with `openspec/inventory.md` listing every
  command, flag, variable, config key, hook and written file against the README section that documents
  it. The README gained a Specs section and fuller command and config reference. No config change;
  nothing to do on upgrade.
- Fix: the usage line for an unknown command now lists `home`. Nothing to do on upgrade.
- Fix: `desk stream` on Windows started claude through `cmd.exe` in a detached process, which has no
  console and exited at once with an empty log and err file. It now starts `claude.exe` directly
  (a `.cmd` shim runs undetached). A test starts a stand-in `claude` and expects output. Nothing to do on upgrade.
- `desk stream --budget <usd>` (or `budgetUsd: <usd>` in a front matter block at the top of the task
  file) passes `--max-budget-usd` to the headless claude; default none. Nothing to do on upgrade.
- `desk sync` carries the desk's own `.claude/settings.json` (permissions, env, hooks, `autoMode`,
  `enabledPlugins`, cache TTLs and any other key) into every repo checkout and worktree, so a session
  opened there gets the desk's guards and allow list. What it carried and later dropped is removed on
  the next sync. Upgrade: run `desk sync`; make the hook commands in the desk's `settings.json` absolute.
- Mod: plan quota on the status line and at the head of the Desk pane (5h and 7d use, reset
  countdown, "full in ~Xh" from the burn rate), outside a desk too. Ported from quota-meter (MIT,
  `THIRD-PARTY.md`); uninstall quota-meter to avoid two lines. Warm-hold now shares the status line.
- Mod, in a desk: cold-cache guard. A send to a cold main cache (50k+ tokens) logs the rewrite it
  causes; `AGENT_DESK_COLD_GUARD=refuse` drops the first such send instead. A cold write arms
  warm-hold for 3h with no agents running. A resumed session counts as cold until its first request;
  a turn that reads a big file is not a cold write. Ported from cache-tax (MIT); uninstall cache-tax
  to avoid a second guard and pinger.
- `desk status` (and so the Desk pane): a "Pull requests" section for open desk branches with a PR,
  in repos with `gh`: review decision, comments, unresolved threads, and feedback newer than the
  head commit. `--watch` prints `PR:` lines on a new decision or new comments. Read-only; the
  section is left out without `gh`. Ported from pr-pulse (MIT). Nothing to do on upgrade.
- Mod: a `ctx 42% · 84k/200k` meter next to the quota, with a handoff or `/compact` hint from 80%.
  After context-lens (MIT); uninstall context-lens to avoid a second line.
- Mod: secret redaction, outside a desk too. Secrets, emails and public IPs (compressed IPv6
  included) become placeholders with a random id (`2606:4700::1111`) in prompts, tool
  results, deny texts and (secrets only) the first message's context blocks, and are swapped back in
  tool input; `Agent`, `SendMessage` and `AskUserQuestion` input keeps the placeholders. The walker
  reads objects under `data` and withholds values past its depth or size limit; only the bare
  example word (up to 4 digits) is exempt from email redaction; a failing toast does not let a
  prompt through. Ported from secret-redactor (MIT) with its defaults and no options; uninstall
  secret-redactor so values are not redacted twice.
- Mod: a `cache 94%` meter after `ctx`: the cache hit (cache read / all input, as in `desk tokens`).
  After token-ledger (MIT), without its `/ledger` pane or cost; uninstall token-ledger.

## 0.1.0 - 2026-10-31

First release, extracted from a working single-repo desk.

- `desk` CLI (Node 20+, no dependencies): `status [--watch]`, `board`, `todo`, `tokens`, `overlap`,
  `decide`, `check`, and new `init`, `sync`, `workspace`, `home`.
- Each desk pins its kit: `desk init` writes the desk's `package.json` with the devDependency
  `github:klintravis/agent-desk#v0.1.0` and runs `npm install` (`--no-install` skips it). Hooks and
  settings call `<desk>/node_modules/agent-desk`; `desk sync` records its version as `kitVersion`.
  `desk init`/`sync` write a `desk` + `desk.cmd` shim into the desk folder, so `<desk>/desk` works
  from any folder without a global install.
- `desk wt new|finish|merge|remove|discard` and `desk stream`: cross-platform ports of the old
  PowerShell scripts. Merges are fast-forward only, to the exact sha the gates checked: every CI
  run on that head green (via `gh`) and a board verdict `MERGE @<head sha>`. `discard` refuses
  another session's claim without `--force`; `remove` and `discard` post `release`.
- Multi-repo: `desk.config.json` lists the repos; `--repo <id>` on slug commands; todo areas are
  repo ids, `desk` or `owner`. Entries are `kind: "git"` (worktrees) or `kind: "folder"` (a plain
  folder: workspace, readable dirs, todo area; no worktrees). `gh` is optional (no CI wait or gate);
  a clone without `origin` is local-only (no fetch or push, local ff merge). Slugs are desk-wide.
- Claude plugin: skills `handoff`, `orchestrate`, `ponytail` (+ `-review`, `-audit`, `-debt`);
  agents `implementer`, `reviewer`, `verifier`, `archiver`; mod with the Desk pane, owner-decisions
  band, `/desk`, `/decide`, prune, warm-hold and edit guard. Inert outside a desk (prune aside).
- Session and subagent context: `SessionStart`/`SubagentStart` hooks that `desk sync` writes into
  each `.claude/settings.local.json`. GitHub Copilot reads the same files, so they are the one hook
  source for both harnesses. The command carries the desk and the checkout: a worktree session
  finds the desk, and in a multi-root workspace only the checkout holding the session answers.
  Re-sync keeps the user's hooks and permissions, and drops the desk's own entries it no longer writes.
- GitHub Copilot: `desk sync` writes skills (`.github/skills/<name>/`) and agents
  (`.github/agents/<name>.agent.md`) into the desk folder's `.github/`; Copilot's hooks are the
  settings hooks above, and a `.github/hooks/agent-desk.json` from an earlier build is deleted.
- Compatible with existing files: `todo.jsonl` and `board.jsonl` read as they are; a claim without
  `repo` means the first repo; area `repo` means the first repo; any worktree prefix via
  `worktreePrefix`; `.claude/agent-rules.md` is read when the desk has no `agent-rules.md`.

Upgrade from a hand-rolled desk: run `desk init` in the desk folder (it keeps existing files), fill
`desk.config.json`, remove your own `SessionStart`/`SubagentStart` context hooks from the desk's
`.claude/settings.json` (and any checkout's settings), then `desk sync`. Both harnesses would
otherwise run the old hooks and the new ones. `init` keeps an existing `.gitignore`: if the desk
folder is a git repo, add `/desk`, `/desk.cmd`, `.claude/settings.local.json` and
`.claude/synced-permissions.json` to it yourself (they hold this machine's absolute paths).
