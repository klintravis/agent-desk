## Why

A desk keeps its shared state in two Markdown files: `NEXT.md` (rulings, open questions, "not yet
verified live", default-branch shas) and the generated `TODO.md`. Sessions edit `NEXT.md` by hand,
which invites merge clashes between parallel sessions, and a future viewer cannot parse it. The owner
ruled (T-40, 2026-11-01) to drop both files: every piece of desk state lives in JSON Lines with a
JSON Schema, and the schemas are the contract for that viewer (T-42).

## What Changes

- **BREAKING** `desk decide T-n "<ruling>"` appends a record to a new `decisions.jsonl` instead of a
  line under `## Rulings recorded` in `NEXT.md`. `desk decide --list [n]` prints the recorded rulings
  (the new way to read them at session start).
- **BREAKING** `TODO.md` is no longer written: `desk todo md` is removed and no todo command
  regenerates it. `desk todo list` is the view.
- New todo area `watch` for "not yet verified live" items; `todo next` skips it, like `owner`.
- `desk status` reads each git repo's default-branch sha live from git (Roots line); nothing stores it.
- JSON Schemas `schemas/desk-config.schema.json`, `todo.schema.json`, `board.schema.json`,
  `decisions.schema.json` ship in the kit. Every JSONL line written carries `v: 1`; reads stay lenient.
- `desk check` validates the desk's config and the three JSONL files against the schemas with a small
  hand-written validator (`lib/schema.mjs`, no dependency) and prints bad lines as warnings.
- `desk init` writes an empty `decisions.jsonl` and no `NEXT.md` or `TODO.md`.
- A full `desk sync` migrates an existing desk once: `NEXT.md` "Rulings recorded" to `decisions.jsonl`,
  "Not yet verified live" to `watch` todos, `NEXT.md` renamed to `NEXT.md.bak`, a generated `TODO.md`
  deleted. Idempotent.
- Skills (`handoff`, `kickoff`, `orchestrate`), `templates/AGENTS.md`, the stream brief, README,
  inventory and tests drop every `NEXT.md` / `TODO.md` reference.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `todos-and-board`: three JSONL files with `v: 1` and schemas; `decisions.jsonl`; area `watch`;
  `TODO.md` and `todo md` removed.
- `desk-cli`: `decide` writes `decisions.jsonl` and gains `--list`; `check` validates desk files;
  `status` shows default-branch shas on the Roots lines.
- `desk-init`: writes `decisions.jsonl`, no `NEXT.md` or `TODO.md`.
- `desk-sync`: one-time, idempotent migration of `NEXT.md` and `TODO.md`.

## Impact

- Code: `bin/desk.mjs` (decide, todo, status, check, appendJsonl), new `lib/schema.mjs`,
  `lib/init.mjs`, `lib/sync.mjs`, `lib/wt.mjs` (stream brief), new `schemas/`, `package.json` `files`.
- Markdown: `skills/handoff`, `skills/kickoff`, `skills/orchestrate`, `templates/AGENTS.md`,
  `templates/NEXT.md` (deleted), README, CHANGELOG, `openspec/inventory.md`.
- Tests: `test/desk.test.mjs`, `test/sync.test.mjs`, built-in self-tests of `decide`.
- Existing desks: run `desk sync` once after upgrading; their own `AGENTS.md` still says "read
  NEXT.md" until edited (see design, Open questions).
