# Changelog

agent-desk follows [Semantic Versioning](https://semver.org). One version covers the `desk` CLI and
the Claude plugin (`package.json` and `.claude-plugin/plugin.json` always agree). Each entry says
what an existing desk must do on upgrade; `desk check` warns while `kitVersion` in
`desk.config.json` differs from the kit installed in the desk's `node_modules`.

## Unreleased

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
  `<...>` (`<password>`, `<SuperSecret>`), `$VAR` and `%VAR%` are not exempted: a real password was
  written in angle brackets. Nothing to do on upgrade.

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
