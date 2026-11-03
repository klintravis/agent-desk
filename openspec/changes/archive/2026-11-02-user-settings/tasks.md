Tests use temp dirs only and never read a real `~/.agent-desk`: the CI runner shares a machine with real users. Before any push, run the desk's `check-names` step from the worktree (the command is in the desk's `CLAUDE.md`; this repo does not name that local path).

## 1. Test isolation first

- [x] 1.1 In `test/helpers.mjs` `env()`, set `AGENT_DESK_SETTINGS` to a non-existent path in a dedicated `mkdtemp` folder outside every desk, repo and worktree a test creates
- [x] 1.2 Grep `test/` and `hooks/*.test.*` for CLI spawns that bypass `env()` (`context.test.mjs` has some) and set the same override there
- [x] 1.3 Add a test that the helper's env names a path under that folder

## 2. Resolver (`lib/config.mjs`)

- [x] 2.1 Add the `MODELS` and `EFFORTS` order arrays, `userSettingsPath(env)` and `readUserSettings(file)` with the allow-list; warn by key name, never by value; no throw
- [x] 2.2 Parse the orchestrate table from `KIT` into task ids; throw if a row does not parse
- [x] 2.3 Add `resolveSettings(c, { file })`: layers, per-value `source`, `shared`, floor raises with the replaced value, warnings for unknown ids and for `CLAUDE_CODE_EFFORT_LEVEL` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`
- [x] 2.4 In `loadConfig`, refuse invalid `tasks` and `floor` values and `fable` in `floor`, as `outputStyle` does
- [x] 2.5 `test/config.test.mjs`: every scenario in `user-settings` and `desk-config`, including malformed, array top level, `__proto__`, a full model id, a secret-like unknown key whose value must not appear in warnings

## 3. Schemas

- [x] 3.1 `schemas/user-settings.schema.json`, using only the keywords `lib/schema.mjs` supports (`type`, `required`, `properties`, `additionalProperties`, `items`, `enum`, `const`, `pattern`, `minLength`); per-task maps as `additionalProperties`
- [x] 3.2 `schemas/desk-config.schema.json`: `tasks` and `floor`, with `floor` model enum excluding `fable`
- [x] 3.3 `schemas/desk-status.schema.json`: `user` in `required` and `properties`; update the `schemaTest` fixtures in `lib/schema.mjs`, and add the new schema to its walk
- [x] 3.4 Test that the schema enums equal `MODELS` and `EFFORTS`; check whether `types/` needs the new status field

## 4. `desk settings`, status, check (`bin/desk.mjs`)

- [x] 4.1 Add `settings [--json]` to dispatch and the usage line; report cache sources from `deskShared` and the user file; env shadow, `desk sync` not yet run and Copilot advisory notes; the outside-orchestrate limit
- [x] 4.2 `statusData` and `statusText`: `user` field and the line under the heading, read through `tryOr`
- [x] 4.3 `check`: `warn` lines, exit code unaffected; read through `tryOr`, so a config `loadConfig` refuses (a `fable` floor) still reaches the schema warning instead of throwing
- [x] 4.4 `test/desk.test.mjs`: scenarios in `desk-cli`; `desk status --json` validates with and without a user file

## 5. Sync (`lib/sync.mjs`)

- [x] 5.1 Overlay the user `cache` in `claudeSettings` regardless of `carry`, after the carried keys, guarded by `check-ignore` per folder (0 or 128 writes; anything else skips and warns)
- [x] 5.2 Add the names to the desk folder's `desk.keys` record; confirm the `carried` record picks them up; confirm a partial sync leaves the record alone
- [x] 5.3 Confirm `syncCopilot` and `copilotAgent` do not read the user file; no code change expected
- [x] 5.4 `test/sync.test.mjs`, never-committed test: `git init` a `multiDesk` desk with the init template's `.gitignore` and both harnesses, sync, commit; add a user file with distinctive values in that outside folder, asserting up front that it is in none of the three git trees (never gitignore it to pass: a broad rule could hide a real leak); sync; assert `git status --porcelain` is empty in the desk, repo `a` and a worktree, and that local files hold the cache keys
- [x] 5.5 `test/sync.test.mjs`: Copilot output byte-identical with and without the file; tracked `settings.local.json` skipped with a warning; removal in checkout and desk folder; malformed file; record holds names only

## 6. Skills

- [x] 6.1 `skills/orchestrate/SKILL.md`: add the id column; replace "the strongest model" with `opus` (owner ruling 2); state `desk settings --json`, the fallback with the floor, and that resolved values beat a todo's at spawn; a Copilot note
- [x] 6.2 `skills/kickoff/SKILL.md` and `skills/handoff/SKILL.md`: `--model` and `--next` use `shared`
- [x] 6.3 Tests: every table row parses, ids unique; skill text names the command, fallback and `shared`

## 7. Verdict records the review model (owner ruling 3)

- [x] 7.1 `agents/reviewer.md` and `agents/verifier.md` post `<VERDICT> @<sha> by <model>/<effort>` from their brief, `by <model>` alone if it gives no effort
- [x] 7.2 `skills/orchestrate/SKILL.md` makes the brief state both; the `desk stream` task text in `lib/wt.mjs` leads to the same result
- [x] 7.3 `mergeOk` tolerates trailing text: test added, code unchanged. `hooks/pane.tsx` verdict colours accept the suffix: tested, code unchanged
- [x] 7.4 `statusData` keeps 120 characters of a verdict, not 60; test that the whole verdict survives
- [x] 7.5 `skills/handoff/SKILL.md` says a todo's `--state` quotes verdicts without the `by` part; test that text. README and design state that the record reaches only people who can read that desk's board

## 8. Docs and close-out

- [x] 8.1 `README.md`: Commands (`desk settings`), Environment variables (`AGENT_DESK_SETTINGS`), Config reference (`tasks`, `floor`), Claude Code and GitHub Copilot (what Copilot honours), a user settings section: file shape, no secrets, floor limits and env overrides, cache version minimums, 1h on usage credits, `desk sync` after an edit, agents outside `orchestrate`, `modelPricing` not offered
- [x] 8.2 `CHANGELOG.md`: the new command, file and keys; the `memo` default (owner ruling 2); the verdict suffix
- [x] 8.3 `openspec/inventory.md`: subcommand, `--json` flag, env var, config keys, files read, status line and field
- [x] 8.4 Run `npm test && claude plugin test && claude plugin validate .` and `openspec validate user-settings --strict`
- [x] 8.5 Run check-names, then archive inside this branch
