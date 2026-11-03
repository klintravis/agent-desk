## Context

The orchestrate skill tells the agent which `model` and `effort` to pass on each Agent call, from a hardcoded table. `desk sync` carries the desk's `.claude/settings.json` keys into each checkout's `.claude/settings.local.json` and generates committed Copilot files from kit frontmatter. Desks commit `.claude/settings.json`, `.github/`, `todo.jsonl`, the workspace file, `desk.config.json` and `AGENTS.md`; they ignore `.claude/settings.local.json`, `.claude/synced-permissions.json` and `board.jsonl`.

Claude Code facts this design rests on (docs, 2026-11-02):

- Settings order: managed, command line, project local, shared project, user. An `env` block in a settings file follows those levels.
- `promptCacheTtl` and `subagentPromptCacheTtl` (`"5m"`, `"1h"`, v2.1.242+) are settings keys; env `CLAUDE_CODE_PROMPT_CACHE_TTL` and `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` beat them; 1h is ignored while a subscription draws usage credits. `idleCompaction` is a boolean, default true, v2.1.290+.
- Subagent model order: per-invocation `model`, frontmatter, env `CLAUDE_CODE_SUBAGENT_MODEL`, main model. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` forces one model on all. `CLAUDE_CODE_EFFORT_LEVEL` beats frontmatter and the `effort` parameter. `maxEffortLevel` and org caps still limit effort. There is no settings key for per-subagent model or effort.
- The Agent tool's `model` accepts `haiku`, `sonnet`, `opus`, `fable` only; `effort` accepts `low` to `max`.

## Goals / Non-Goals

**Goals:** per-user model, effort and cache choices without editing a shared file; a desk minimum that beats the user; a visible source for each value; nothing personal in git.

**Non-Goals:** permissions, deny rules, check commands or repo config from the user file; a per-desk personal file; writing the user file (T-87 will); enforcing a floor against the user's own environment.

## Decisions

### Layers and shape

Model and effort resolve independently, per task id, last wins: `kit` (the skill's table) -> `desk` (`desk.config.json` `tasks`) -> `user` (user file `tasks`) -> floor. Each value reports its source, so `{ model: 'opus', effort: 'low' }` can come from two layers.

```json
{ "tasks": { "review": { "model": "sonnet", "effort": "medium" }, "docs": { "effort": "medium" } },
  "cache": { "promptCacheTtl": "5m", "idleCompaction": false } }
```

`desk.config.json` adds `tasks` of the same shape and `floor`, as in `"floor": { "review": { "model": "opus", "effort": "high" } }`. A `$schema` key is allowed in the user file so an editor can find its schema; it has no other effect.

### Task ids: one source, in the skill

The table gains a first column of stable ids: `find`, `ci-summary`, `close-out`, `scribe`, `docs`, `implement`, `fix-known`, `implement-hard`, `propose`, `debug`, `review`, `review-sensitive`, `fix-verify`, `memo`. The resolver parses the table from the running kit's `skills/orchestrate/SKILL.md` (it ships in `files`). Parsing rather than copying means the fallback and the resolver can never disagree; a test asserts every row parses and ids are unique. A table that does not parse makes `desk settings` exit 1, which is the skill's fallback path.

Frontmatter is what an agent runs on when started without parameters. Every table row gives both values, so frontmatter can never win in task resolution and the resolver does not read it. It stays in the layer story only for agents started outside `orchestrate` (below).

### Order, fable and full ids

`haiku < sonnet < opus < fable`, because the model docs call Fable the most capable. `fable` is a valid value for a user or a desk, but not a floor: not every account has it and it can bill to usage credits, so a desk must not impose that on a teammate. `loadConfig` refuses it.

Full model ids, `best`, `default`, `opusplan`, `inherit` and `[1m]` forms are rejected: they cannot be ranked, so a floor could not hold, and the Agent tool's parameter does not accept them. In the user file the one value warns and is ignored. In `desk.config.json` `loadConfig` throws, the same as a bad `outputStyle`: a committed mistake fails loudly for the author instead of silently dropping a floor.

`max` in a user or desk value counts as "the user asks for it" for the skill's rule on `max`. The skill's escalation rule still goes up from the resolved value.

### What the floor is and is not

A floor raises, per dimension, and applies whichever layer the value came from. When it raises, the source is `floor` and the entry records the value it replaced. An unknown task id warns (a kit upgrade can retire one; `loadConfig` does not know the ids, as they live in the skill).

The floor holds in the resolver's output and in what the skill passes. It is not a security boundary:

- `CLAUDE_CODE_EFFORT_LEVEL` beats the `effort` parameter, so that env var runs a floored review at the level it names, up or down.
- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` replaces the model.
- `maxEffortLevel`, org caps and unsupported levels lower effort from above, and an allowlist can swap a blocked model.
- A user can edit `desk.config.json` or ignore the skill.

`desk settings` and `desk check` warn when the first two are visible in `process.env`. When the skill runs the command inside a session, the Bash tool's environment includes a settings-file `env` block, which is the case that matters; from a plain terminal they may not show.

### Resolver contract

`resolveSettings(c, { file = userSettingsPath(process.env) } = {})` returns tasks, cache and warnings and does not throw on anything in the user file. `userSettingsPath(env)` is `env.AGENT_DESK_SETTINGS ?? ~/.agent-desk/settings.json`; an empty value names no file. It reads the file once per call and only when a command needs it: `settings`, `status`, `check`, `sync`, `wt new`.

The user file is a trust boundary. Only allow-listed names are read, using a `Set` of known task ids and an allow-list of cache keys, so `__proto__` or `permissions` go nowhere. Warnings name a key and never print a value, so a secret pasted there does not reach a log. The file's validity is per value: one bad value does not lose the others. For that reason acceptance is coded against the order arrays rather than a whole-file `validate`, and a test compares those arrays with the schema's enums so they cannot drift.

`shared` per task is the same resolution with the user layer left out. It is what `kickoff` records and what the status line compares against.

### Assessment 1: how cache keys take effect

Document-only is not honest here. Both desks commit the TTLs in `.claude/settings.json`, and sync carries them into checkouts' `settings.local.json`; both outrank `~/.claude/settings.json`, so a user's value there has no effect in a desk. Dropping the keys from the desks would make it work, but removes the desk's default for everyone and leaves Copilot-independent tooling (T-87) editing Claude's own file.

The smallest working answer is an overlay in `claudeSettings`: about three lines plus the record.

- The overlay applies whether or not `carry` is set, since `keys` is `{}` for the desk folder.
- It goes in after the carried keys, so the user beats the desk, and only these three keys can pass.
- `mergeSettings` and `dropStale` already do the rest. The carried record in `.claude/synced-permissions.json` derives from `claudeSettings`, so it needs nothing; the desk folder's `desk.keys` record is extended by the same names. The record holds key names only, never values.
- **On removal,** the next full `desk sync` drops the key: a checkout falls back to the desk's carried value, and the desk folder falls back to its `.claude/settings.json`.

Guard: user values are written only where `git -C <dir> check-ignore -q .claude/settings.local.json` exits 0 (ignored) or 128 (not a git folder), checked after `excludeLocal`. `check-ignore` reports a tracked file as not ignored, so one call covers both a tracked file and a missing ignore. Any other result skips the overlay and warns, naming the file. `info/exclude` alone would not stop a repo that tracks the file.

No floor for cache: a TTL is cost, not a quality minimum. `desk settings` reports each key's source, warns when the env vars shadow a key, and says to run `desk sync` when the desk's local file does not hold the user's value yet.

### Assessment 2: plugin `userConfig` versus the file

It cannot replace the file and is not worth adding now. It is Claude-only, while Copilot users need the same data. `/config` is terminal-only, so the VS Code panel cannot reach it. `CLAUDE_PLUGIN_OPTION_<KEY>` reaches hooks, not the `desk` CLI run from the Bash tool, so the resolver could not read it. `${user_config.KEY}` is documented for the Markdown body, with frontmatter not listed (not tested), and bypasses the floor either way. It stores flat values, so 13 tasks by 2 values is 26 rows, and T-87 wants a file it can edit. A complement could later mirror a value into the file, but two sources for one setting has no user asking for it.

### Assessment 3: agents started outside `orchestrate`

Accept and document. They run on frontmatter or their caller's parameters. The cheap-looking fixes do not hold: `${user_config.KEY}` is not documented for frontmatter, where these values live, and has no floor; a `PreToolUse` hook rewriting Agent calls costs a hook on every call and cannot map `subagent_type` to a task (`reviewer` has two rows). `desk settings` prints the limit once and the README states it. `CLAUDE_CODE_SUBAGENT_MODEL` remains the user's own tool for this case.

### Assessment 4: Copilot

`syncCopilot` and `copilotAgent` never call the resolver. `model` stays dropped (Claude aliases are not Copilot ids), `reasoning-effort` stays the kit's frontmatter value, and desk `tasks` and `floor` do not reach `.agent.md` either, since an agent has several rows.

At runtime the skill copy in `.github/skills/` tells the agent to run `desk settings --json`. `runSubagent` has a model parameter, but Claude aliases are not valid ids there, a choice above the main model's cost tier does not run, and no per-call effort is documented. So on Copilot the user layer and the floor are advisory: `desk settings` says so when the `copilot` harness is on. Cache keys are Claude Code settings and do nothing for Copilot.

### Keeping the user layer out of committed files

| Output | Committed | User values |
|---|---|---|
| `.claude/settings.local.json`, guarded | no | `cache` only |
| `.claude/synced-permissions.json` | no | key names only |
| `desk settings`, `desk status` stdout | no | yes |
| `.github/agents`, `.github/skills`, workspace, `AGENTS.md`, `desk.config.json` | yes | never |
| `todo.jsonl` through skills | yes | never, by skill text only: `shared` values, and verdicts quoted without their `by` part |
| `board.jsonl` (verdict with `by <model>/<effort>`) | no, gitignored | the review model an agent reports |

`tasks` values have no writer at all: nothing writes them to any file. The test does not list outputs. It commits a synced desk, adds a user file with distinctive values, syncs again and asserts `git status --porcelain` is empty in the desk, a repo and a worktree, so a new leak in any file fails it.

Free text is the limit: an agent could copy a value into a commit message or a handoff note. The guarantee covers what the kit writes.

### Visibility

`desk status` adds one line directly under the heading, only when a user layer is active, and `user` in the JSON (`null` otherwise; `v` stays 1, the field is additive). The line names tasks where the resolved value is below `shared`, so a cheaper review stands out, and floor raises. Without a user layer the screen is unchanged. `gatherStatus` wraps the read in `tryOr`.

### The verdict records the review model

Owner ruling 3. The status line shows a cheaper review only on that user's machine, so the verdict carries the record as well: `reviewer` and `verifier` post `<VERDICT> @<sha> by <model>/<effort>`, using what their brief states, and `by <model>` alone if the brief gives no effort. `orchestrate` makes the brief state both. The `desk stream` task text in `lib/wt.mjs` says the same, because a stream spawns its own reviewer.

The value is what the brief states, not something the kit observes, so it is a record and not a proof. The floor stays the control.

No parser changes. `mergeOk` matches `MERGE @<sha>` with trailing text allowed and the pane's verdict colour looks at the start of the text; tests pin both with the suffix. `statusData` cut verdicts at 60 characters, which would lose the suffix, so the limit goes to 120, what the board stores.

**The record reaches only people who can read that desk's board.** `board.jsonl` is gitignored, so the suffix never reaches git by itself. `todo.jsonl` is committed, so `skills/handoff/SKILL.md` tells the agent to quote a verdict in a todo's `--state` without the `by` part, and a test checks that text. Nobody on another machine sees the record unless they share the desk folder.

## Risks / Trade-offs

- A floor can be beaten from the user's own environment. Documented and warned about; a real limit needs managed settings.
- `kickoff` and `handoff` staying clean relies on skill text. A test checks the text; nothing checks an agent. The same holds for a verdict's `by` part in a todo's `--state`.
- A verdict's `by` part repeats the brief. A wrong brief gives a wrong record.
- Cache edits need `desk sync`. `desk settings` flags the gap, and an open session keeps its settings until restarted.
- `wt new` is a partial sync, so its record does not move: a key written there and removed before any full sync stays stale. The same is true of carried desk keys today.
- A hand-set cache key in a `settings.local.json` is overwritten by the user layer and removed with it, like other synced keys.
- Reading the table from the running kit means a desk pinned to an older kit than its plugin sees that kit's table. They share a version, and `desk check` already warns on drift.

## Migration Plan

None. Existing desks keep working; a desk adds `floor` when it wants one. Renaming a task id later is breaking for user files and goes in the CHANGELOG.
