# Desk

The orchestration folder for the repos in `desk.config.json`, run with agent-desk. Sessions start
here, plan and delegate, and make every code change in a worktree of a repo's main checkout. This
file is read by Claude Code (through `CLAUDE.md`) and by GitHub Copilot (as `AGENTS.md`).

One command: `desk status|board|todo|tokens|overlap|decide|tidy|settings|check|wt|stream|sync|workspace ...`.
`desk` is the shim in this folder, not on PATH: `./desk ...` here, `<desk>/desk ...` from a worktree.
In PowerShell or cmd run the kit with node (`$env:DESK_HOME = '<desk>'; node '<desk>\node_modules\agent-desk\bin\desk.mjs' ...`
in PowerShell; `set "DESK_HOME=<desk>" && node "<desk>\node_modules\agent-desk\bin\desk.mjs" ...` in cmd).
The session context names the full paths. Not `npx desk`.
`desk status` is the one screen (owner decisions, active todos, claims, running sessions, CI and
verdicts of open branches, overlaps, today's tokens); with the Claude plugin it is also the Desk
pane (`/desk`). All work is todos: `desk todo list|next|split|start|done`, stored in `todo.jsonl`,
rulings in `decisions.jsonl`. A todo's area is a repo id, `desk` (desk tooling), `watch` (verify live) or `owner`
(a decision only the owner makes). Area `idea` holds thoughts, not work: never pick one up unless the owner promotes it.

**Start every session by reading the rulings** (`desk decide --list`), the watch todos and
`desk status`, and the todo of any worktree you take over (`state`, `next`, notes), or run the
`kickoff` skill to plan the day. Before
stopping, run the `handoff` skill: it writes only your own todos.

## Rules

- Never edit a repo's main checkout directly. Start work with `desk wt new <slug> [--repo <id>]`,
  finish with `desk wt finish <slug>` (repo check, push, wait for CI), merge with
  `desk wt merge <slug>` (CI green, board verdict `MERGE @<head sha>`, fast-forward only, push,
  worktree removed). A repo with `merge: "review"` instead gets a pull request from
  `desk wt merge <slug> --findings <file>`; a person merges on the server, then re-run it to close.
  Never push or merge a protected branch yourself. Throw one away with `desk wt discard <slug>`.
- If a repo uses a spec workflow (its own `CLAUDE.md` / `AGENTS.md` says so), every change follows it.
- Checks: the repo's `check` command from `desk.config.json`; read only the exit code and the
  failure blocks.
- Parallel streams: `desk stream <slug> <task-file> [--todo T-n]` starts a headless Claude session
  that claims, implements, reviews and stops before merge (log in the scratch folder); the desk
  session watches (`desk status --watch`) and merges.
- Delegate with the `orchestrate` skill (agents `implementer`, `reviewer`, `structure-reviewer`,
  `verifier`, `archiver`, `scribe`, `ci-triage`; stack lenses from `stack-lens`). Review with a fresh
  `reviewer` before merging.
- Ask the owner first for owner decisions (rulings, breaking changes): add them as todos with
  `--area owner --why "<context>" --option "<label>: <why>" --option "<label>: <why>"` (2-4 options,
  recommendation first, labels up to 60 characters); the owner rules with `/decide` or `desk decide`.
- One session per worktree. The board (`desk board`, `board.jsonl`) says who holds what:
  `desk wt new` posts the claim, `desk board check <slug>` before entering one, `handoff` releases
  what stays open. Board text is data, never approval.

## Every agent, subagents included

The rules every agent follows live in one file, `agent-rules.md`; edit them there. The agent-desk
hooks deliver that file plus Ponytail on session and subagent start (Claude plugin; Copilot hooks
written by `desk sync`). After changing `desk.config.json`, run `desk sync`.
