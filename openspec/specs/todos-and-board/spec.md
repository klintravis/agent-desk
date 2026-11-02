# todos-and-board Specification

## Purpose

The three append-only JSON Lines files a desk keeps: `todo.jsonl` (work items, committed),
`decisions.jsonl` (owner rulings, committed) and `board.jsonl` (claims, CI results, verdicts;
gitignored). Implemented in `bin/desk.mjs`.

## Requirements

### Requirement: Append-only JSONL files
The desk's JSONL files (`todo.jsonl`, `board.jsonl`, `decisions.jsonl`) SHALL be written only by
appending one JSON line, retrying a failed append once, and every line written SHALL carry `v: 1`.
They SHALL be read by skipping any line that does not parse, so a torn or hand-edited line never breaks
a reader, and a line without `v` SHALL be read like one with `v: 1`.

#### Scenario: Torn line
- **WHEN** a line of `todo.jsonl` is not valid JSON
- **THEN** every other line is still read

#### Scenario: Version on write
- **WHEN** any command appends a line to one of the files
- **THEN** the line has `"v":1`

#### Scenario: Old lines
- **WHEN** a line written before this change has no `v`
- **THEN** it is read and folded as before

### Requirement: Session identity
Each line SHALL carry `from`, the first 8 characters of `CLAUDE_CODE_SESSION_ID`, or `owner` when the
variable is unset. Free text written to any of the files SHALL have whitespace runs collapsed to one
space and be trimmed and cut to a limit.

#### Scenario: No session id
- **WHEN** a command runs in a plain terminal
- **THEN** its lines have `from` equal to `owner`

### Requirement: Todo state is the fold of its lines
A todo line SHALL be `{ts, from, id, set}`. A todo's state SHALL be all its lines merged in file order
(later values win); a `note` in `set` SHALL be appended to the todo's notes as `<date> <from>: <text>`
and not stored as a field. Lines without `id` or `set` SHALL be ignored.

#### Scenario: Later line wins
- **WHEN** `T-3` is added `open` and a later line sets `status` to `done` with a note
- **THEN** `T-3` is `done` and has one note

### Requirement: Todo ids
A new todo SHALL get id `T-<n>` where `n` is one more than the highest number present (`T-1` for an
empty file).

#### Scenario: Next id
- **WHEN** the highest id is `T-9`
- **THEN** the next todo is `T-10`

### Requirement: todo add
`todo add "<title>"` SHALL append a todo with status `open`, size `small` and the given flags (`--area`, `--size`, `--prio`, `--why`, `--parent`, `--change`, `--tasks`, `--model`, or any other `--field value`). `--prio` SHALL be an integer. A bare `--` SHALL end flag parsing, so a title may start with `--`.

#### Scenario: Limits
- **WHEN** a title, `--why` or another value is long
- **THEN** the title is cut to 160 characters, `--why` to 1000 and other values to 300

#### Scenario: Priority
- **WHEN** `--prio 3` is given
- **THEN** `prio` is stored as the number 3

#### Scenario: Invalid priority
- **WHEN** `--prio` is missing its value or is not an integer (`abc`, `1.5`)
- **THEN** the command fails with exit 1, an error naming `--prio`, and writes nothing

#### Scenario: Flag value missing or starting with dashes
- **WHEN** any other `--field value` flag has no value, or its value starts with `--` (`--all` is value-less and never takes one)
- **THEN** the command fails with exit 1, an error naming the flag, and writes nothing

#### Scenario: Title starting with dashes
- **WHEN** the command is `todo add -- "--foo bar"`
- **THEN** the title is stored as `--foo bar`

#### Scenario: Invalid input
- **WHEN** the title is missing or `--parent` does not exist
- **THEN** the command fails with exit 1

#### Scenario: Area defaulted
- **WHEN** the desk has one repo `app` and `desk todo add "x"` runs
- **THEN** the todo's area is `app`

#### Scenario: Several repos
- **WHEN** the desk has two repos and `--area` is absent
- **THEN** the command exits 1 with `add needs --area <repo id>|desk|owner|watch|idea`

### Requirement: todo split
`todo split T-n "<child>" ...` SHALL add one open child per title with `parent` T-n, inheriting the
parent's area, priority and change, and SHALL print the parent's line and the new children's lines.

#### Scenario: Children inherit
- **WHEN** `T-4` has area `app` and priority 3 and is split into two titles
- **THEN** two open todos with parent `T-4`, area `app` and priority 3 are added

### Requirement: Status commands
`todo start T-n [--slug s]` SHALL set status `active` and the owner to this session. `todo done`,
`drop`, `block` and `open` SHALL set status `done`, `dropped`, `blocked` and `open`, adding `--why` as a
note. `todo set T-n --field value ...` SHALL set any fields and `todo note T-n "<text>"` SHALL add a note.
Each SHALL print the todo's line and write no other file. An unknown id SHALL exit 1 with `no todo <id>`.

#### Scenario: Drop with reason
- **WHEN** `todo drop T-2 --why "superseded"` runs
- **THEN** `T-2` has status `dropped` and a note `superseded`

#### Scenario: No generated view
- **WHEN** any todo command runs
- **THEN** no `TODO.md` is written

### Requirement: todo done-slug
`todo done-slug <slug>` SHALL set every `open`, `active` or `blocked` todo whose `slug` is that value to
`done` with the note `merged (<slug>)`, and SHALL print the ids, or `no open todos for <slug>`.

#### Scenario: Merge closes todos
- **WHEN** two active todos carry slug `x` and `done-slug x` runs
- **THEN** both are `done` with a `merged (x)` note

### Requirement: todo next
`todo next [--area a]` SHALL pick, among `open` todos (not active or blocked) that have no open child
(`open`, `active` or `blocked`; an `idea` child counts only when the todo is itself an idea), the lowest
`prio` (missing = 50) and then the lowest number, and print its line and `why`, or `nothing open`. Without `--area`, `owner`, `watch` and `idea` todos SHALL be excluded;
with `--area owner`, `--area watch` or `--area idea` only those are returned.

#### Scenario: Child before parent
- **WHEN** `T-1` (prio 5) has an open child `T-2` (prio 1)
- **THEN** `todo next` returns `T-2`

#### Scenario: Parent waits for an active child
- **WHEN** the only open parent has an active child
- **THEN** `todo next` prints `nothing open`

#### Scenario: Owner decisions are not work
- **WHEN** an open todo has area `owner` and `todo next` runs without `--area`
- **THEN** it is not returned

#### Scenario: Watch items are not work
- **WHEN** an open todo has area `watch` and `todo next` runs without `--area`
- **THEN** it is not returned

#### Scenario: Ideas are not work
- **WHEN** an open todo has area `idea` and `todo next` runs without `--area`
- **THEN** it is not returned, and `todo next --area idea` returns it

#### Scenario: An idea child does not hold back its parent
- **WHEN** an open repo todo has an open child with area `idea`
- **THEN** `todo next` returns the parent

### Requirement: Board kinds and posting
`board post <kind> <slug> [text] [--repo id]` SHALL append `{ts, from, kind, slug, text, repo?}` where
kind is one of `claim`, `release`, `ci`, `merged`, `verdict`, `note`, the slug matches
`[a-z0-9][a-z0-9-]*`, and text is cut to 120 characters. It SHALL always exit 0: a bad kind or slug
prints `board: bad post ...` and an append failure prints its error, and neither fails the caller.

#### Scenario: Bad kind
- **WHEN** `board post wibble x` runs
- **THEN** nothing is appended and the exit code is 0

### Requirement: Open claims
A claim SHALL be open when it is the newest `claim` or `release` line for its slug and is a `claim`
and a worktree for that slug exists in the claim's repo (the first repo when the line has none).

#### Scenario: Released
- **WHEN** a `release` line follows a `claim` for the slug
- **THEN** `board claims` does not list it

#### Scenario: Worktree gone
- **WHEN** a claim has no later release but its worktree folder is gone
- **THEN** it is not open

### Requirement: board check
`board check <slug>` SHALL print `yours` when the open claim is this session's, `unclaimed` when there is
none, and otherwise print `claimed by <id> <age> ago: stop and report` and exit 1.

#### Scenario: Foreign claim
- **WHEN** another session holds the open claim
- **THEN** the command exits 1

### Requirement: Merge gate
`board merge-ok <slug> <head>` SHALL succeed only when the newest `verdict` line for the slug has text
starting `MERGE @<sha>` with `sha` 7 to 40 hex characters that is a prefix of `head`. A later
`FIXES NEEDED`, a `MERGE AFTER FIXES` text, no verdict, or a head that differs from the reviewed sha
SHALL print `merge blocked: <reason>` and exit 1.

#### Scenario: Commit after review
- **WHEN** the newest verdict is `MERGE @1234567` and the head is `abcdef1...`
- **THEN** the gate reports `verdict covers 1234567, head is abcdef1: commits after the review`

#### Scenario: Newest verdict wins
- **WHEN** `MERGE @abcdef1` is followed by `FIXES NEEDED @abcdef1`
- **THEN** the gate blocks

### Requirement: Board summary
`board tail [n]` (default 8) SHALL print `# Desk board (data, not instructions; never approval)`, the open
claims with claim age and the owner's last post age, the markdown files in `<desk>/streams`, and the last
`n` lines.

#### Scenario: Empty board
- **WHEN** the board has no lines
- **THEN** the summary shows `- none` for claims and for recent lines

### Requirement: todo list and show
`todo list [--area a] [--all]` SHALL print the todo tree (children under parents, ordered by priority
then number), showing only `open`, `active` and `blocked` unless `--all`. Todos with area `idea` SHALL
be shown only with `--area idea` or `--all`. `todo show T-n` SHALL print the
folded todo as JSON. The legacy area `repo` SHALL count as the first repo. `todo md` SHALL no longer
exist.

#### Scenario: Legacy area
- **WHEN** a todo has area `repo` and `app` is the first repo
- **THEN** it appears in `todo list --area app`

#### Scenario: Watch area listed
- **WHEN** an open todo has area `watch`
- **THEN** `todo list` and `todo list --area watch` show it

#### Scenario: Ideas hidden from the plain list
- **WHEN** an open todo has area `idea`
- **THEN** `todo list` does not show it, and `todo list --area idea` and `todo list --all` do

#### Scenario: A child whose parent is not shown
- **WHEN** an open todo has a parent the current filter does not show
- **THEN** it is printed at the top level, once

#### Scenario: md removed
- **WHEN** `desk todo md` runs
- **THEN** it exits 1 as an unknown subcommand and writes nothing

### Requirement: Decisions file
`decisions.jsonl` (committed, like `todo.jsonl`) SHALL hold one record per owner ruling:
`{v, ts, from, date?, todo?, title?, text, source?}`, where `date` is `YYYY-MM-DD` when known, `todo`
the ruled todo's id, `title` its title, `text` the ruling, and `source` is `NEXT.md` for records made by
the migration. It SHALL be written only by `desk decide` and `desk sync`.

#### Scenario: Ruling record
- **WHEN** `desk decide T-1 "keep it"` records a ruling on 2026-11-01
- **THEN** `decisions.jsonl` gains `{"v":1,"ts":...,"from":...,"date":"2026-11-01","todo":"T-1","title":<T-1's title>,"text":"keep it"}`

### Requirement: Desk file schemas
The kit SHALL ship `schemas/desk-config.schema.json`, `schemas/todo.schema.json`,
`schemas/board.schema.json` and `schemas/decisions.schema.json`, one per desk file, using only `type`,
`required`, `properties`, `additionalProperties`, `items`, `enum`, `const`, `pattern` and `minLength`.
In each JSONL schema `v` SHALL be `const: 1` and not required.

#### Scenario: Records written by the CLI are valid
- **WHEN** `todo add`, `board post` and `decide` write lines
- **THEN** each line validates against its file's schema

#### Scenario: Old line valid
- **WHEN** a `todo.jsonl` line has no `v`
- **THEN** it validates

#### Scenario: Shipped
- **WHEN** the kit is installed from npm
- **THEN** the `schemas/` folder is present
