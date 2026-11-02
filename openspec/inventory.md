# Inventory

Every user-visible item of agent-desk, taken from the code (not from the README), with the README
section that documents it. The first column is a literal string: the README check greps for it
(see the loop at the end). Keep this file in step with the code when a command, flag, variable,
config key, hook or written file is added.

Section names are README headings.

## CLI subcommands

| item | where in code | README section |
|---|---|---|
| `desk status` | `bin/desk.mjs` `status`, `statusText`, `gatherStatus` | Commands, Status watch |
| `desk todo` | `bin/desk.mjs` `todo` | Todos |
| `desk board` | `bin/desk.mjs` `board` | Board |
| `desk decide` | `bin/desk.mjs` `decide`, `decideText`, `rulingsText` | Owner decisions |
| `desk wt` | `lib/wt.mjs` `wt` | Worktree flow |
| `desk stream` | `lib/wt.mjs` `stream`, `brief`, `taskFile`, `claudeLauncher` | Streams |
| `desk tokens` | `bin/desk.mjs` `tokens`, `tokenRows`, `tally` | Tokens and overlaps |
| `desk overlap` | `bin/desk.mjs` `overlap`, `currentOverlaps` | Tokens and overlaps |
| `desk init` | `lib/init.mjs` `initCmd`, `init`, `pinKit` | Quickstart |
| `desk sync` | `lib/sync.mjs` `sync` | Quickstart, Claude Code and GitHub Copilot |
| `desk workspace` | `lib/sync.mjs` `workspace` | Commands |
| `desk check` | `bin/desk.mjs` `check` | Commands |
| `desk home` | `bin/desk.mjs` `main` | Commands |
| `desk --version` | `bin/desk.mjs` `main` | Commands |
| `desk --self-test` | `bin/desk.mjs` `main`, each command's `--self-test` | Commands |

## todo actions

| item | where in code | README section |
|---|---|---|
| `todo add` | `bin/desk.mjs` `todo` | Todos |
| `todo split` | `bin/desk.mjs` `todo` | Todos |
| `todo start` | `bin/desk.mjs` `todo` | Todos |
| `todo done` | `bin/desk.mjs` `todo` | Todos |
| `todo drop` | `bin/desk.mjs` `todo` | Todos |
| `todo block` | `bin/desk.mjs` `todo` | Todos |
| `todo open` | `bin/desk.mjs` `todo` | Todos |
| `todo set` | `bin/desk.mjs` `todo` | Todos |
| `todo note` | `bin/desk.mjs` `todo` | Todos |
| `todo done-slug` | `bin/desk.mjs` `doneSlug` | Todos |
| `todo list` | `bin/desk.mjs` `tree` | Todos |
| `todo next` | `bin/desk.mjs` `next` | Todos |
| `todo show` | `bin/desk.mjs` `todo` | Todos |

## board actions

| item | where in code | README section |
|---|---|---|
| `board post` | `bin/desk.mjs` `post` | Board |
| `board claims` | `bin/desk.mjs` `openClaims` | Board |
| `board check` | `bin/desk.mjs` `board` | Board |
| `board merge-ok` | `bin/desk.mjs` `mergeOk` | Board |
| `board tail` | `bin/desk.mjs` `summary` | Board |

## wt actions

| item | where in code | README section |
|---|---|---|
| `wt new` | `lib/wt.mjs` `wtNew` | Worktree flow |
| `wt finish` | `lib/wt.mjs` `finish` | Worktree flow |
| `wt merge` | `lib/wt.mjs` `merge` | Worktree flow |
| `wt remove` | `lib/wt.mjs` `remove` | Worktree flow |
| `wt discard` | `lib/wt.mjs` `discard` | Worktree flow |

## Flags

| item | where in code | README section |
|---|---|---|
| `--watch` | `bin/desk.mjs` `status`, `watch` | Status watch |
| `--json` | `bin/desk.mjs` `status`, `statusData` | Status watch |
| `--area` | `bin/desk.mjs` `todo` | Todos |
| area `watch` | `bin/desk.mjs` `next`, `lib/sync.mjs` `migrateDesk` | Todos |
| area `idea` | `bin/desk.mjs` `next`, `tree` | Todos |
| `--list` (decide) | `bin/desk.mjs` `decide`, `rulingsText` | Owner decisions |
| `--size` | `bin/desk.mjs` `todoLine` (any field via `flags`) | Todos |
| `--prio` | `bin/desk.mjs` `flags` | Todos |
| `--` (end of flags) | `bin/desk.mjs` `flags` | Todos |
| `--why` | `bin/desk.mjs` `todo`, `decideText` | Todos, Owner decisions |
| `--parent` | `bin/desk.mjs` `todo add` | Todos |
| `--change` | `bin/desk.mjs` `todoLine` | Todos |
| `--tasks` | `bin/desk.mjs` `todoLine` | Todos |
| `--model` | `bin/desk.mjs` `todoLine` | Todos |
| `--slug` | `bin/desk.mjs` `doneSlug` (field set by `todo start`) | Todos |
| `--state` | handoff skill, shown by `statusText` | Todos |
| `--next` | handoff skill, shown by `statusText` | Todos |
| `--all` | `bin/desk.mjs` `todo list` | Todos |
| `--repo` | `bin/desk.mjs` `board`, `lib/wt.mjs` `flags`, `lib/init.mjs` | Worktree flow, Quickstart |
| `--base` | `lib/wt.mjs` `wtNew` | Worktree flow |
| `--no-build` | `lib/wt.mjs` `wtNew` | Worktree flow |
| `--no-wait` | `lib/wt.mjs` `finish` | Worktree flow |
| `--rebased` | `lib/wt.mjs` `finish` | Worktree flow |
| `--force` | `lib/wt.mjs` `discard` | Worktree flow |
| `--todo` | `lib/wt.mjs` `brief` | Streams |
| `--desk` | `lib/wt.mjs` `brief` | Streams |
| `--max-turns` | `lib/wt.mjs` `stream` | Streams |
| `--budget` | `lib/wt.mjs` `taskFile`, `stream` | Streams |
| `--dry-run` | `lib/wt.mjs` `stream` | Streams |
| `--json` | `bin/desk.mjs` `tokens`; `scripts/friction-scan.mjs` | Tokens and overlaps, Commands |
| `--session` | `bin/desk.mjs` `tokens` | Tokens and overlaps |
| `--worktrees` | `lib/init.mjs` `init` | Commands |
| `--harness` | `lib/init.mjs` `init` | Commands |
| `--no-install` | `lib/init.mjs` `initCmd` | Commands |
| `--since` | `scripts/friction-scan.mjs` | Commands |

## Environment variables

| item | where in code | README section |
|---|---|---|
| `DESK_HOME` | `lib/config.mjs` `findDesk`; `lib/sync.mjs` settings `env`; `lib/wt.mjs` `stream` | Environment variables |
| `CLAUDE_CODE_SESSION_ID` | `bin/desk.mjs` `me`, `tokens`; `lib/wt.mjs` `SESSION_ENV` | Environment variables |
| `CLAUDE_PROJECT_DIR` | `scripts/subagent-context.mjs` | Environment variables |
| `AGENT_DESK_COLD_GUARD` | `hooks/register.ts` `prompt.submit` | Cold-cache guard, Environment variables |
| `CLAUDECODE` | `lib/wt.mjs` `SESSION_ENV` | Environment variables |
| `CLAUDE_CODE_ENTRYPOINT` | `lib/wt.mjs` `SESSION_ENV` | Environment variables |
| `CLAUDE_CODE_SSE_PORT` | `lib/wt.mjs` `SESSION_ENV` | Environment variables |

## desk.config.json keys

| item | where in code | README section |
|---|---|---|
| `kitVersion` | `lib/init.mjs`, `lib/sync.mjs` `recordKitVersion`, `bin/desk.mjs` `check` | Config reference |
| `worktreesDir` | `lib/config.mjs` `loadConfig` | Config reference |
| `scratchDir` | `lib/config.mjs` `loadConfig`, `lib/wt.mjs` `stream` | Config reference |
| `harnesses` | `lib/config.mjs`, `lib/sync.mjs` `sync` | Config reference |
| `outputStyle` | `lib/config.mjs` `loadConfig`, `lib/sync.mjs` `claudeSettings`, `scripts/subagent-context.mjs` | Config reference |
| `permissions` | `lib/config.mjs`, `lib/sync.mjs` `claudeSettings` | Config reference |
| `additionalDirectories` | `lib/sync.mjs` `claudeSettings` | Config reference |
| `repos[].id` | `lib/config.mjs` `loadConfig` | Config reference |
| `repos[].path` | `lib/config.mjs` `loadConfig` | Config reference |
| `repos[].kind` | `lib/config.mjs` `KINDS` | Config reference |
| `repos[].gh` | `lib/config.mjs`, `bin/desk.mjs` `ghRuns`, `ghPrs` | Config reference |
| `repos[].defaultBranch` | `lib/config.mjs` `baseRef` | Config reference |
| `repos[].branchPrefix` | `lib/config.mjs`, `lib/wt.mjs` | Config reference |
| `repos[].worktreePrefix` | `lib/config.mjs` `loadConfig`, `worktreeList` | Config reference |
| `repos[].install` | `lib/wt.mjs` `wtNew` | Config reference |
| `repos[].build` | `lib/wt.mjs` `wtNew` | Config reference |
| `repos[].check` | `lib/wt.mjs` `finish` | Config reference |

## Mod (hooks/register.ts) and UI

| item | where in code | README section |
|---|---|---|
| `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` | host switch for `hooks/hooks.json` modules | Install |
| Auto-compaction prune | `hooks/register.ts` `session.compact`, `hooks/prune.ts` | Auto-compaction prune |
| Warm-hold | `hooks/warmhold.ts` `tick`, `register.ts` `session.start`; status shown in the pane Warm row | Warm-hold (in a desk) |
| keep-warm toggle | `hooks/pane.tsx` Warm row Button, `warm` atom, `Deps.off` | Warm-hold (in a desk) |
| pane rows Style, Agents | `hooks/pane.tsx`, `register.ts` `prompt.compose`, minute tick `trackAgents` | Desk pane |
| Cold-cache guard | `hooks/warmhold.ts` `coldSend`, `register.ts` `prompt.submit` | Cold-cache guard |
| Edit guard | `hooks/editguard.mjs` `verdict`, `register.ts` `tool.call` | Claude Code and GitHub Copilot |
| `turn.complete` | `hooks/register.ts` `on('turn.complete')`: session meters, warm-hold arming | Session meters, Warm-hold (in a desk) |
| `turn.step` | `hooks/register.ts` `on('turn.step')`: warm-hold request clock | Warm-hold (in a desk) |
| `prompt.context` | `hooks/redact.ts` `on('prompt.context')`: secret scrub of first-message blocks | Secret redaction |
| Desk pane | `hooks/pane.tsx` `startPane`, `registerPane`; `register.ts` `session.start`, `session.attach` | Desk pane |
| owner-decisions band | `hooks/pane.tsx` `ui.render` `AbovePrompt` | Desk pane |
| `/desk` | `hooks/pane.tsx` `command.run` desk | Desk pane |
| `/decide` | `hooks/pane.tsx` `command.run` decide | Desk pane |
| status line | `hooks/meters.ts` `paint`, `line`, `bar` | Session meters |
| `desk-status` schema | `schemas/desk-status.schema.json`, `lib/schema.mjs` `schemaTest` | Status watch |
| Plan quota | `hooks/quota.ts` `quotaLine` | Session meters |
| Context fullness | `hooks/meters.ts` `ctxLine` | Session meters |
| Cache | `hooks/meters.ts` `cacheLine` | Session meters |
| Secret redaction | `hooks/redact.ts` | Secret redaction |
| toast | `hooks/register.ts` (prune), `hooks/redact.ts` `redactPrompt` | Secret redaction, Auto-compaction prune |
| notice | `hooks/redact.ts` `registerRedact` | Secret redaction |
| `[REDACTED-SECRET-` | `hooks/redact.ts` `mint` | Secret redaction |
| `[REDACTED-EMAIL-` | `hooks/redact.ts` `mint` | Secret redaction |
| `[REDACTED-IP-` | `hooks/redact.ts` `mint` | Secret redaction |
| `SendMessage` | `hooks/redact.ts` `NO_RESTORE` | Secret redaction |
| `AskUserQuestion` | `hooks/redact.ts` `NO_RESTORE` | Secret redaction |
| 1500 characters | `hooks/prune.ts` `CUT_OVER` | Auto-compaction prune |
| 8 messages | `hooks/prune.ts` `KEEP_RECENT` | Auto-compaction prune |
| 30% | `hooks/register.ts` `MIN_SAVING` | Auto-compaction prune |
| 50 minutes | `hooks/warmhold.ts` `PING_AFTER` | Warm-hold |
| 4 hours | `hooks/warmhold.ts` `MAX_HOLD` | Warm-hold |
| 3 hours | `hooks/warmhold.ts` `AUTO_WARM` | Cold-cache guard |
| 50k | `hooks/warmhold.ts` `BIG` | Cold-cache guard |
| 80% | `hooks/meters.ts` `CTX_HINT` | Session meters |
| `desk-status` | `hooks/pane.tsx` `PANE` | Desk pane |
| `quota-samples` (plugin store key) | `hooks/meters.ts` `QUOTA_KEY` | Session meters |
| `types/index.d.ts` | `DeskStatus`, `DeskMeters`, `WarmState`, `AgentRow` atom shapes | Desk pane |

## Scripts

| item | where in code | README section |
|---|---|---|
| `scripts/subagent-context.mjs` | SessionStart and SubagentStart hook | What is in the kit, Claude Code and GitHub Copilot |
| `scripts/edit-guard.mjs` | PreToolUse hook script | What is in the kit, Claude Code and GitHub Copilot |
| `scripts/friction-scan.mjs` | transcript scan | What is in the kit |
| `scripts/release.mjs bump` | `scripts/release.mjs` `bump` | Versioning and upgrade |
| `scripts/release.mjs notes` | `scripts/release.mjs` `notes` | Versioning and upgrade |
| `scripts/release.mjs publish` | `scripts/release.mjs` `publish`: one commit from the tag's tree on the public `main`, with the tag | Versioning and upgrade |
| `.github/workflows/ci.yml` | push and pull request: `npm test` on a self-hosted runner on a private repo, hosted Linux, Windows and macOS otherwise | Versioning and upgrade |
| `.github/workflows/release.yml` | tag `v*` push (skipped on a private repo): `npm test`, gate on `main`, GitHub release | Versioning and upgrade |

## Skills, agents, templates

| item | where in code | README section |
|---|---|---|
| `kickoff` | `skills/kickoff/SKILL.md` | What is in the kit |
| `handoff` | `skills/handoff/SKILL.md` | What is in the kit |
| `orchestrate` | `skills/orchestrate/SKILL.md` | What is in the kit |
| `ponytail` | `skills/ponytail/SKILL.md` | What is in the kit |
| `ponytail-review` | `skills/ponytail-review/SKILL.md` | What is in the kit |
| `ponytail-audit` | `skills/ponytail-audit/SKILL.md` | What is in the kit |
| `ponytail-debt` | `skills/ponytail-debt/SKILL.md` | What is in the kit |
| `implementer` | `agents/implementer.md` | What is in the kit |
| `reviewer` | `agents/reviewer.md` | What is in the kit |
| `verifier` | `agents/verifier.md` | What is in the kit |
| `archiver` | `agents/archiver.md` | What is in the kit |
| `templates/AGENTS.md` | `lib/init.mjs` `init` | What is in the kit |
| `schemas/*.schema.json` | `lib/schema.mjs` `deskFileWarnings` | What is in the kit, Commands |
| `templates/agent-rules.md` | `lib/init.mjs` `init`, read by `scripts/subagent-context.mjs` | What is in the kit |
| `.claude-plugin/plugin.json` | plugin manifest | What is in the kit |
| `.claude-plugin/marketplace.json` | marketplace entry | What is in the kit |
| `hooks/hooks.json` | registers `./register.ts` | What is in the kit |

## Files written

| item | where in code | README section |
|---|---|---|
| `desk.config.json` | `lib/init.mjs` | Quickstart |
| `AGENTS.md` | `lib/init.mjs` | Quickstart |
| `CLAUDE.md` | `lib/init.mjs` | Quickstart |
| `decisions.jsonl` | `lib/init.mjs`, `bin/desk.mjs` `decide`, `lib/sync.mjs` `migrateDesk` | Quickstart, Owner decisions |
| `NEXT.md.bak` | `lib/sync.mjs` `migrateDesk` | Versioning and upgrade |
| `agent-rules.md` | `lib/init.mjs` | Quickstart |
| `todo.jsonl` | `lib/init.mjs`, `bin/desk.mjs` | Todos |
| `board.jsonl` | `lib/init.mjs`, `bin/desk.mjs` | Board |
| `.gitignore` | `lib/init.mjs` | Quickstart |
| `.code-workspace` | `lib/sync.mjs` `workspace` | Quickstart |
| `.vscode/settings.json` | `lib/sync.mjs` `hidePlumbing` | VS Code settings |
| `package.json` | `lib/init.mjs` `pinKit` | Install |
| `desk.cmd` | `lib/sync.mjs` `writeShim` | Install |
| `written by desk sync` | `lib/sync.mjs` `SHIM_MARK` | Quickstart |
| `settings.local.json` | `lib/sync.mjs` `syncCheckout` | Quickstart |
| `synced-permissions.json` | `lib/sync.mjs` `syncedFile` | Quickstart |
| `info/exclude` | `lib/sync.mjs` `excludeLocal` | Quickstart |
| `.github/skills/<name>/` | `lib/sync.mjs` `syncCopilot` | Claude Code and GitHub Copilot |
| `.github/agents/<name>.agent.md` | `lib/sync.mjs` `copilotAgent` | Claude Code and GitHub Copilot |
| `.github/hooks/agent-desk.json` | removed by `syncCopilot` | Claude Code and GitHub Copilot |
| `streams/` | `bin/desk.mjs` `summary`, `lib/wt.mjs` `dropStream` | Board |
| `<slug>-prompt.txt` | `lib/wt.mjs` `stream` | Streams |
| `<slug>-run.jsonl` | `lib/wt.mjs` `stream` | Streams |
| `.claude/settings.json` | carried by `lib/sync.mjs` `deskShared` | Quickstart |
| `notes.md` | `.github/workflows/release.yml` (CI scratch file, the release body) | Versioning and upgrade |

## Status screen sections and watch lines

| item | where in code | README section |
|---|---|---|
| Owner decisions waiting | `bin/desk.mjs` `statusText` | Status watch |
| Active todos | `bin/desk.mjs` `statusText` | Status watch |
| Running sessions | `bin/desk.mjs` `statusText` | Status watch |
| Open branches | `bin/desk.mjs` `statusText` | Status watch |
| Pull requests | `bin/desk.mjs` `statusText`, `prState` | Commands |
| Tokens today | `bin/desk.mjs` `statusText` | Status watch |
| `BOARD:` | `bin/desk.mjs` `watchDiff` | Status watch |
| `CI:` | `bin/desk.mjs` `watchDiff` | Status watch |
| `AGENT+:` | `bin/desk.mjs` `watchDiff` | Status watch |
| `CTX>250k:` | `bin/desk.mjs` `watchDiff` | Status watch |
| `OVERLAP:` | `bin/desk.mjs` `watchDiff` | Status watch |
| `OWNER+:` | `bin/desk.mjs` `watchDiff` | Status watch |
| `PR:` | `bin/desk.mjs` `watchDiff` | Status watch |

## README check

Run from the repository root. It prints each item the README does not contain, and nothing when
every item is there.

```sh
sed -n 's/^| `\([^`]*\)` |.*/\1/p;s/^| \([^`|][^|]*[^ |]\) |.*/\1/p' openspec/inventory.md \
  | grep -vE '^(item|-+)$' \
  | while IFS= read -r item; do grep -qF -- "$item" README.md || echo "MISS: $item"; done
```
