## Context

Owner ruling T-40 (2026-11-01) drops `NEXT.md` and `TODO.md` from desks and moves their content to
JSONL files with JSON Schemas. Today `NEXT.md` has four sections (Work, Waiting on the owner, Rulings
recorded, Not yet verified live) plus default-branch sha lines and free text; real desks also carry
extra sections (Efficiency notes) and an unbulleted "Not yet verified live" paragraph. `TODO.md` is
regenerated from `todo.jsonl` after every todo command. The CLI has no dependencies and no JSON
Schema validator.

## Goals / Non-Goals

**Goals:** every piece of shared desk state is a JSONL record or live git state; one schema per desk
file as a stable contract; existing desks migrate with one `desk sync`.

**Non-Goals:** the viewer itself; a full JSON Schema implementation; migrating `NEXT.md` sections the
ruling does not name (Work, Efficiency notes, free text: they stay in `NEXT.md.bak`).

## Decisions

### Where each `NEXT.md` part goes
| `NEXT.md` part | Now |
|---|---|
| Rulings recorded | `decisions.jsonl`, written by `desk decide`, read with `desk decide --list` |
| Waiting on the owner | owner todos (unchanged) |
| Not yet verified live | todos with area `watch`; closed with `todo done T-n --why "<verified how>"` |
| Default-branch sha lines | not stored; `desk status` Roots lines read them live |
| Work | todos (already the case) |
| Efficiency notes (handoff) | a todo note on the session's todo (below) |

### Handoff's efficiency notes and free-form work notes go to todo notes
`board.jsonl` is gitignored and cuts text to 120 characters, so anything durable written there is
lost. Todo notes are committed, dated, attributed and shown by `todo show`. So:
- **Efficiency notes**: `D todo note T-n "efficiency: <agent> peak <n>k / fresh <n>k: <why>"` on the
  todo the agent worked on (the session's own todo; a desk-area todo when it had none).
- **Free-form work notes**: stay on the slug's todo (`--state`, `--next`, `todo note`), and long
  narrative in `<desk>/streams/<slug>.md` as today. Nothing goes to the board except the existing
  claim/release/ci/verdict/merged/note posts.

### Rulings are read with `desk decide --list [n]`
Sessions, kickoff and the stream brief said "read NEXT.md" to learn the rulings. The replacement is
`desk decide --list [n]` (default 20, oldest first): it reuses the existing `decide` command, so the
Dispatch requirement does not change, and it keeps the status screen short. Each line:
`- <date|undated>[ (<T-n>)]: [<title>: ]<text>`.

### `decisions.jsonl` record
`{v: 1, ts, from, date?, todo?, title?, text, source?}`. `desk decide` writes `todo`, `title` (the todo's title,
cut to 160) and `text` (the ruling, cut to 1000), `date` = UTC day of `ts`. Migrated records keep
the whole bullet as `text` (attribution included, through `clean(…, 1000)` like every written text;
`NEXT.md.bak` keeps anything longer) and set `date` and `todo` only when the
bullet has them; `source: "NEXT.md"` marks them. Required: `ts`, `from`, `text`.

### `v: 1` is added on write, optional on read
The files are append-only, so lines written before this change never get `v`. The schemas declare
`v` as `{"const": 1}` but do not list it in `required`; otherwise `desk check` would warn on every old
line forever. `appendJsonl` adds `v: 1` in one place, which covers `post`, `writeTodo`, `decide` and
the migration. A future `v: 2` reader can tell old from new by the field.

### Validator: hand-written, `lib/schema.mjs`
The repo has no dependencies and no validator. `lib/schema.mjs` exports `validate(schema, value)`
returning a list of `<path>: <message>` strings, and supports only: `type` (object, array, string,
integer, number, boolean, and a type list), `required`, `properties`, `additionalProperties`
(boolean or schema), `items`, `enum`, `const`, `pattern`, `minLength`. `$schema`, `$id`, `title` and
`description` are ignored. Anything else in a schema is a programming error caught by a self-test
that walks the four shipped schemas. The schemas use only that subset so any standard validator
(the viewer's) gives the same answers.
- `desk-config.schema.json`: the documented keys and their types; `additionalProperties` allowed at
  the top level (`lib/config.mjs` already throws on the errors that matter).
- `todo.schema.json`: `{v?, ts, from, id: "^T-\\d+$", set: object}`; `set` known fields typed
  (`status` enum, `prio` integer, `area` string, ...), extra fields allowed (`todo add --any value`).
- `board.schema.json`: `{v?, ts, from, kind: enum, slug: pattern, text?, repo?}`.
- `decisions.schema.json`: as above.

`package.json` `files` gains `schemas`, or an npm-installed kit has nothing to validate against.

### `desk check` warns, never fails, on desk files
After the JSON parse step, `desk check` validates `desk.config.json` and each line of `todo.jsonl`,
`board.jsonl` and `decisions.jsonl` (missing file: skipped). A bad line, including one that does not
parse, prints `warn <file>:<line>: <first error>`; at most 5 per file, then `warn <file>: +N more`.
Exit code unaffected. Readers keep skipping unparseable lines and accept lines without `v`.

### `decide` keeps its write order
Append to `decisions.jsonl` first, then close the todo: a failed append leaves the todo open and the
ruling can be given again. `addRuling` and its CRLF / missing-heading cases go away.

### Default-branch sha on the Roots line
Each git root line gains `, <defaultBranch> @<sha7>` from `baseRef(repo)` (origin as last fetched,
else local; no fetch), `@?` when unreadable. No new section, so the section order and the pane's
heading-based parsing (`## Owner decisions waiting`) are unaffected.

### Area `watch`
A plain area like `desk`: `todo add --area watch`, listed by `todo list`, excluded from `todo next`
without `--area` (as `owner` is), not shown in status' Active todos unless started. The `add needs
--area` message names it.

### Migration in `desk sync`
Runs only on a full sync (no arguments), like the other records, in `lib/sync.mjs`. Unlike
`recordKitVersion` it is not gated on `process.exitCode`: a skipped checkout or a foreign shim says
nothing about the desk's own files, and gating would silently skip the migration.
1. `NEXT.md` present and `NEXT.md.bak` absent: parse the `## Rulings recorded` and
   `## Not yet verified live` sections. An item is a `- ` bullet plus its continuation lines (indented
   or non-blank, until the next bullet, blank line or heading), joined with single spaces; a section
   with no bullets yields one item per blank-line-separated paragraph. CRLF and LF both parse. For a
   ruling: `date` = first `YYYY-MM-DD`, `todo` = the `T-<n>` in the `Owner, <date> (T-<n>):` prefix `desk decide` wrote (none otherwise: a
   `T-n` elsewhere may be another desk's). For a watch item:
   a `watch` todo with the first 160 characters as title and the full text as `why`.
2. Idempotence: compare after the same `clean()` and limit used on write (1000 for `text` and `why`,
   160 for a title): skip a ruling whose cleaned text equals an existing record's `text`; skip a watch
   item whose cleaned text equals an existing `watch` todo's `why`. So a run interrupted before the rename
   repeats without duplicates.
3. Rename `NEXT.md` to `NEXT.md.bak`; print `migrated NEXT.md: <r> rulings, <w> watch todos (NEXT.md.bak
   keeps: <other section names>)`. Other sections (owner answer, 2026-11-01): Work, Efficiency notes,
   Waiting on the owner and free text are not migrated. Named are every `## ` heading other than the
   two migrated ones whose body is non-blank, plus `preamble` when the text before the first `## `
   holds more than the `# ` title and one intro paragraph (a sha paragraph, for instance); an empty
   section is not named.
   A migrated section is also named when a non-blank line in it was not migrated (lead-in line, second
   paragraph, subheading) or an item was cut at 1000 characters.
4. Both `NEXT.md` and `NEXT.md.bak` present: warn, leave both (never clobber a backup) and exit 1; the
   migration runs last in sync so the exit code does not skip the other writes.
5. `TODO.md` is deleted only when it starts with `# Desk todos` and holds
   ``Generated from `todo.jsonl` ``; otherwise `kept TODO.md: not generated by desk` (a desk folder can
   itself be a repo with its own `TODO.md`).
6. `AGENTS.md` patch (owner answer, 2026-11-01), below.

### `AGENTS.md` patch in `desk sync`
`desk init` never overwrites `AGENTS.md`, so desks made before this change keep "Start every session
by reading `NEXT.md`". A full sync patches the desk's `AGENTS.md` line by line: a line equal (trailing
`\r` ignored) to one of the shipped template lines that name `NEXT.md` / `TODO.md` is replaced by its
new template line; the file keeps its line endings. Every shipped template version has the same three
such lines (`viewed in the generated TODO.md...`, `**Start every session by reading NEXT.md**...`,
`stopping, run the handoff skill: ... your lines of NEXT.md.`), and the new lines keep the wrap points
(the second still ends in `and`, the third still starts with `stopping,`), so the result reads right
around either shipped version of the line between them. A line that still names `NEXT.md` or `TODO.md`
but is not a shipped one was edited by the owner: it is left and sync prints
`AGENTS.md:<n> names NEXT.md/TODO.md: edit by hand`. A patched file prints `patched AGENTS.md: <n>
lines`. Patched lines name neither file, so a second run prints nothing (idempotent). The map lives in
`lib/sync.mjs`; a test asserts every new line appears verbatim in `templates/AGENTS.md`.

## Risks / Trade-offs

- [Existing desks' `AGENTS.md` keeps saying "read NEXT.md"] → `desk sync` patches the shipped lines;
  an edited line is named for a hand edit.
- [Migration parse misses an oddly formatted ruling] → text is never lost: `NEXT.md.bak` stays, and
  the summary line lets the session spot a zero count.
- [Hand-written validator drifts from JSON Schema semantics] → only the listed keywords; a self-test
  rejects schemas using others.
- [`todo md` removal breaks a script calling it] → it exits 1 as an unknown subcommand; CHANGELOG says
  so.

## Migration Plan

Upgrade the kit, run `desk sync` (full), commit `decisions.jsonl`, `todo.jsonl`, `AGENTS.md` and the
deletions in the desk folder; hand-edit only the `AGENTS.md` lines sync names. Rollback: restore
`NEXT.md.bak` and `AGENTS.md` from git; records in `decisions.jsonl` are harmless to an older kit.

## Open Questions

None. The owner answered both (2026-11-01): `desk sync` patches the shipped `AGENTS.md` lines (an
edited line is left and named), and the sections the ruling does not cover stay in `NEXT.md.bak`,
named by sync.
