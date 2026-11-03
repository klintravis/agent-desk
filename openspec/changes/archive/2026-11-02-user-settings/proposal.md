## Why

Model, effort and cache choices live in shared places only: the table in `skills/orchestrate/SKILL.md`, `agents/*.md` frontmatter and the committed `.claude/settings.json` of a desk. A user who wants a cheaper review or a shorter cache TTL has to change a file the whole team shares. Owner request (T-88, folds in T-30): each user tunes agent selection and cache settings, per user and by the user, while a desk can still hold a minimum and nothing personal reaches git.

The cache half cannot be solved by documentation alone. Claude Code ranks project settings above `~/.claude/settings.json`, and both desks in use commit `promptCacheTtl` and `subagentPromptCacheTtl`, so a user's own value there is silently shadowed.

## What Changes

- New user file `~/.agent-desk/settings.json` (env `AGENT_DESK_SETTINGS` overrides the path), holding only `tasks` (model and effort per task id) and `cache` (`promptCacheTtl`, `subagentPromptCacheTtl`, `idleCompaction`). The kit reads it and never writes it. Unknown keys warn by name and are ignored; a malformed file warns and is ignored; it never breaks a command.
- New keys in `desk.config.json`: `tasks` (desk values per task id) and `floor` (per task id minimums).
- A resolver in `lib/config.mjs`: for model and effort, last wins: kit table, `desk.config.json`, user file, then the desk floor, which only raises.
- Order: `haiku < sonnet < opus < fable`; `low < medium < high < xhigh < max`. Full model ids and other aliases are rejected explicitly.
- New command `desk settings [--json]`: resolved model and effort per task, with the source layer of each value, the cache keys with theirs, and warnings. Read-only.
- `skills/orchestrate/SKILL.md` calls it and keeps its table as the fallback. The table gains a stable task id column and is the single source of kit defaults.
- `desk status` shows a line and a `user` JSON field when a user layer is active; `desk check` adds warn lines.
- `desk sync` and `desk wt new` overlay the user's `cache` onto `.claude/settings.local.json` only, and only where git confirms that file is ignored. Removing a value removes the key.
- The user layer never reaches a committed file: `.github/agents/*.agent.md`, `.github/skills/`, the workspace file, `desk.config.json` and `AGENTS.md` stay byte-identical with or without a user file. A test proves it with `git status --porcelain`.
- `kickoff` and `handoff` record shared values, never user-resolved ones, because `todo.jsonl` is committed.
- The review verdict records the review model: `<VERDICT> @<sha> by <model>/<effort>`. `statusData` keeps the whole verdict (120 characters, what the board stores). The record stays out of git.
- **Cut:** `modelPricing`. It is honoured in managed settings only and ignored in user, project and local files, so T-30's mention of it is dropped.

Not in this change: a per-desk personal file, a user-file editor (T-87), plugin `userConfig`, any write to `~/.claude/` or `~/.copilot/`.

## Capabilities

### New Capabilities

- `user-settings`: the user file, the layers, the floor and order, and what the orchestrate, kickoff and handoff skills do with the result.

### Modified Capabilities

- `desk-cli`: the `settings` command; the user layer on the status screen, in status JSON and in `desk check`.
- `desk-config`: the `tasks` and `floor` keys.
- `desk-sync`: user cache keys in local settings files only; committed output independent of the user file.

## Impact

- Code: `lib/config.mjs`, `lib/sync.mjs`, `bin/desk.mjs`.
- Skills and agents: `skills/orchestrate/SKILL.md`, `skills/kickoff/SKILL.md`, `skills/handoff/SKILL.md`, `agents/reviewer.md`, `agents/verifier.md`; the stream task text in `lib/wt.mjs`.
- Schemas: `schemas/desk-config.schema.json`, new `schemas/user-settings.schema.json`, `schemas/desk-status.schema.json`.
- Tests: `test/config.test.mjs`, `test/sync.test.mjs`, `test/desk.test.mjs`, `hooks/pane.test.tsx`; `test/helpers.mjs` sets the override for every CLI test.
- Docs: `README.md`, `CHANGELOG.md`, `openspec/inventory.md`.
- Compatibility: additive. No user file and no new desk keys means today's values, except the Plan row (owner ruling 2) and the `by` suffix on new verdicts, which `mergeOk` and the pane already tolerate.

## Owner rulings

Ruled 2026-11-02. The artifacts follow these.

1. **Where the desk layer for cache lives:** in the desk's existing `.claude/settings.json`, with no `cache` key in `desk.config.json`. The layer order for cache is desk settings file, then user file.
2. **The "strongest model" row defaults to `opus`,** which every account has; users with Fable set `memo` to `fable` in their file. This is the one behaviour change for people with no user file, where an orchestrator reading "strongest" may pick Fable today.
3. **A teammate's cheaper review is recorded on the verdict.** The floor and the status line stay as well. `reviewer` and `verifier` post `<VERDICT> @<sha> by <model>/<effort>` from what their brief states, `by <model>` alone if it gives no effort. `orchestrate` makes the brief state both, and the `desk stream` task text leads to the same result. The record reaches only people who can read that desk's board: `board.jsonl` is gitignored and a todo's `--state` quotes verdicts without the `by` part. A desk that needs a control rather than a record sets a floor.
4. **What kickoff and handoff write into `todo.jsonl`:** the `shared` value (kit, desk, floor; no user layer), so the todo line and pane stay as they are, with the resolved value applied at spawn. This is skill text, so it depends on the agent following it.
5. **No Copilot user layer until T-87.** Precedence between user and workspace agents of the same name is undocumented, and the kit would be writing outside its own folders. Until then the user layer is advisory on Copilot.
6. **The floor when `desk settings` fails:** the skill falls back to its table, and the fallback text tells the agent to raise to any `floor` entry in `desk.config.json` if that file is readable.
