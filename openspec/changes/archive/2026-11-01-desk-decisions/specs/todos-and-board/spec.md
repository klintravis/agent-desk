## MODIFIED Requirements

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
- **THEN** the command exits 1 with `add needs --area <repo id>|desk|owner|watch`

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

### Requirement: todo next
`todo next [--area a]` SHALL pick, among `open` todos (not active or blocked) that have no open child
(`open`, `active` or `blocked`), the lowest `prio` (missing = 50) and then the lowest number, and print
its line and `why`, or `nothing open`. Without `--area`, `owner` and `watch` todos SHALL be excluded;
with `--area owner` or `--area watch` only those are returned.

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

## REMOVED Requirements

### Requirement: todo list, show and md
**Reason**: `TODO.md` is dropped from desks (owner ruling T-40); `todo md` goes with it.
**Migration**: use `desk todo list`; `desk sync` deletes a generated `TODO.md`. See `todo list and show`.

## ADDED Requirements

### Requirement: todo list and show
`todo list [--area a] [--all]` SHALL print the todo tree (children under parents, ordered by priority
then number), showing only `open`, `active` and `blocked` unless `--all`. `todo show T-n` SHALL print the
folded todo as JSON. The legacy area `repo` SHALL count as the first repo. `todo md` SHALL no longer
exist.

#### Scenario: Legacy area
- **WHEN** a todo has area `repo` and `app` is the first repo
- **THEN** it appears in `todo list --area app`

#### Scenario: Watch area listed
- **WHEN** an open todo has area `watch`
- **THEN** `todo list` and `todo list --area watch` show it

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
