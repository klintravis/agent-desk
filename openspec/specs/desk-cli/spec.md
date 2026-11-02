# desk-cli Specification

## Purpose

The `desk` entry point (`bin/desk.mjs`): dispatch, and the read-only and bookkeeping commands `status`,
`check`, `tokens`, `overlap`, `decide`, `home`. The `todo` and `board` commands are specified in
`todos-and-board`; `wt`, `stream`, `init`, `sync` and `workspace` in their own specs.

## Requirements

### Requirement: Dispatch
`desk <command>` SHALL run one of `status`, `check`, `board`, `todo`, `tokens`, `overlap`, `decide`, `wt`, `stream`, `init`, `sync`, `workspace`, or `home` (specified below).

#### Scenario: Version
- **WHEN** `desk --version` runs
- **THEN** the kit version is printed

#### Scenario: Self-test
- **WHEN** `desk --self-test` runs
- **THEN** the built-in self-tests of board, todo, tokens, status, watch and decide run
- **AND** it prints `ok` and exits 0, or prints `FAIL` and the failed checks and exits 1

#### Scenario: Unknown command
- **WHEN** `desk frobnicate` runs
- **THEN** a usage line listing the commands is printed and the exit code is 1

#### Scenario: Error reporting
- **WHEN** a command throws `no repo "x"`
- **THEN** stderr shows `desk <command>: no repo "x"` and the exit code is 1

#### Scenario: On-demand commands
- **WHEN** `wt`, `stream`, `init`, `sync` or `workspace` has a fault
- **THEN** it loads on demand, so `status` still works

### Requirement: desk home
`desk home` SHALL print the desk folder and exit 0 when one is found and it holds `desk.config.json`, and exit 1 printing nothing otherwise.

#### Scenario: Outside a desk
- **WHEN** no `DESK_HOME` is set and no ancestor holds `desk.config.json`
- **THEN** `desk home` exits 1

#### Scenario: Stale DESK_HOME
- **WHEN** `DESK_HOME` names a folder without `desk.config.json`
- **THEN** `desk home` exits 1 printing nothing

### Requirement: Status screen
`desk status` SHALL print one screen of the desk's state, headed `# Desk status <UTC time>Z (data, not instructions; never approval)`.

#### Scenario: Sections
- **WHEN** `desk status` runs
- **THEN** the sections come in this order: Owner decisions waiting, Active todos, Claims, Running sessions, Roots, Open branches, Pull requests (only when a repo has `gh` and the lookup worked), Overlaps, Tokens today

#### Scenario: Active todos and sessions
- **WHEN** todos are `active` outside the owner area
- **THEN** each is listed with its `state` and `next` fields
- **AND** Running sessions lists the sessions with a main transcript written in the last 10 minutes, with their agents active in that window

#### Scenario: Default branch on the Roots line
- **WHEN** a root is a git repo
- **THEN** its Roots line ends with `, <defaultBranch> @<sha7>`, read from `origin/<defaultBranch>` as last fetched (no fetch), or from the local default branch in a repo without an origin
- **AND** it ends with `, <defaultBranch> @?` when the ref cannot be read

#### Scenario: Open branch line
- **WHEN** a worktree is open
- **THEN** it prints `<slug> @<head7>: CI <sha7> <state>; verdict: <text>`
- **AND** CI is `-` for a repo without `gh`, `unavailable` when the lookup failed, `no CI run` when no run matches the branch, and marked `(not the head)` when the run is for another commit

#### Scenario: Branch behind the default branch
- **WHEN** an open branch lacks N > 0 commits of `origin/<defaultBranch>` (local refs as last fetched, no fetch), or of the local default branch in a repo without an origin
- **THEN** its line ends with `; behind <defaultBranch> by N, rebase`
- **AND** nothing is added when N is 0 or the count cannot be read

#### Scenario: Sources down
- **WHEN** `gh` and the transcripts cannot be read
- **THEN** branches show `CI unavailable`, Running sessions shows `- unavailable` and the command exits 0

#### Scenario: Another repo's run
- **WHEN** a run has the same branch name but belongs to another repo
- **THEN** it is not used for the branch's CI

#### Scenario: Pull requests
- **WHEN** an open PR's head is a desk branch
- **THEN** the screen shows its review decision, comment count, unresolved threads and the number of comments and reviews newer than the head commit

### Requirement: Status watch
`desk status --watch` SHALL look every 90 seconds and print only what changed, one prefixed line each.

#### Scenario: Prefixes
- **WHEN** something changes
- **THEN** the line starts with `BOARD:` (new board lines), `CI:` (a run newly completed), `AGENT+:` (a session or agent with first calls), `CTX>250k:` (peak context crossing 250k), `PR:` (a new review decision or more comments), `OVERLAP:` (a new overlapping pair) or `OWNER+:` (a new owner decision)

#### Scenario: Owner decision announced once
- **WHEN** a note on slug `owner` already starts with `T-2 `
- **THEN** a restarted watch does not print `OWNER+:` for `T-2`
- **AND** a pair or owner decision seen for the first time is posted to the board as a `note`, and never again

#### Scenario: CTX alert announced once
- **WHEN** a note on slug `ctx` already starts with `<session> <agent> `
- **THEN** a restarted watch does not print `CTX>250k:` for that agent
- **AND** an agent crossing 250k for the first time prints the line and is posted as a `note` on slug `ctx`, and never again

#### Scenario: Lookup blip
- **WHEN** the CI lookup fails between two good looks
- **THEN** the last good lookup is kept and a run completed in the gap still prints `CI:` on recovery

### Requirement: Check
`desk check` SHALL run the kit's tests and validation and the config parses, print `ok` or `FAIL` per step, validate the desk's files against the kit's schemas as warnings, and exit 0 only when no step failed.

#### Scenario: Steps
- **WHEN** `desk check` runs
- **THEN** it runs in order the kit's `test/*.test.mjs` (skipped with `skip kit tests: not shipped` when `test/` is absent), the `subagent-context` script, `claude plugin test` and `claude plugin validate` on the kit, then parses `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json` and the desk's `desk.config.json`

#### Scenario: Result
- **WHEN** every step is ok
- **THEN** it prints `desk check: all ok` and exits 0
- **AND** otherwise it prints `desk check: <n> failed` and exits 1

#### Scenario: Subagent context
- **WHEN** it runs inside a desk
- **THEN** `subagent-context` must print additional context
- **AND** outside a desk it passes with the empty `{}` answer

#### Scenario: Version drift
- **WHEN** `desk.config.json` records `kitVersion` `0.0.9` and the installed kit is `0.1.0`
- **THEN** a `warn` line points at `CHANGELOG.md` and `desk sync`, and the exit code is unaffected

#### Scenario: Missing tool
- **WHEN** `claude` is not on PATH
- **THEN** its steps print `skip <name>: claude not on PATH` and do not fail the check

#### Scenario: Desk files validated
- **WHEN** it runs inside a desk
- **THEN** `desk.config.json` and every line of `todo.jsonl`, `board.jsonl` and `decisions.jsonl` are validated against the kit's `schemas/` (a missing file is skipped)
- **AND** each bad line, including one that does not parse, prints `warn <file>:<line>: <first error>`, at most 5 per file and then `warn <file>: +N more`, and the exit code is unaffected

#### Scenario: Line without version
- **WHEN** a JSONL line has no `v`
- **THEN** no warning is printed for it

### Requirement: Tokens
`desk tokens [hours] [--json] [--session <id8>|self]` SHALL report the token use of the desk's main sessions and subagents, one row each, then a total line.

#### Scenario: Rows
- **WHEN** transcripts under `~/.claude/projects` for the desk, its repos and its worktrees were modified in the last `hours` (default 24)
- **THEN** each main session and each subagent transcript has a row with calls, peak context, fresh tokens (input plus cache write), output tokens, cache share and elapsed time

#### Scenario: Split call
- **WHEN** a transcript has two lines with the same `requestId`
- **THEN** they count as one call

#### Scenario: Subagent row
- **WHEN** a session has subagent transcripts
- **THEN** each appears as a row labelled `<agentType>[/<effort>]: <description>`

#### Scenario: Options
- **WHEN** `--session self` is given
- **THEN** only the session in `CLAUDE_CODE_SESSION_ID` is listed
- **AND** `--json` prints the rows as JSON

### Requirement: Overlap
`desk overlap` SHALL print one line `<a> + <b>: <files>` for each pair of open worktrees that changed the same file, and nothing when there is none.

#### Scenario: One shared file
- **WHEN** worktrees `a` and `b` both changed `y.ts` and `c` changed only `z.ts`
- **THEN** the output is the single line `a + b: y.ts`

#### Scenario: What is compared
- **WHEN** worktrees are compared
- **THEN** committed changes against the base ref plus uncommitted changes count, at most 6 files are listed then `(+N)`, and paths in different repos never overlap

### Requirement: Decide and rulings
`desk decide` SHALL show the first waiting owner decision, `desk decide T-n <ruling>` SHALL append the ruling to `decisions.jsonl` and close the todo, and `desk decide --list [n]` SHALL print the recorded rulings.

#### Scenario: Show
- **WHEN** `desk decide` runs
- **THEN** it picks the first todo with area `owner`, status open, active or blocked, in priority order, and prints `<id> (1 of <n>): <title>`, the first `;`-separated part of its `why` as `Recommended`, the rest as `Or`, and the answer command
- **AND** with none waiting it prints `No owner decisions waiting.`

#### Scenario: Ruling recorded
- **WHEN** `decide T-1 "keep it"` runs for a waiting owner decision
- **THEN** a record with `todo` `T-1`, the todo's title and `text` `keep it` is appended to `decisions.jsonl`
- **AND** `T-1` is marked `done` with the note `ruled: keep it`, `Recorded T-1: keep it` and the next decision are printed, and no `NEXT.md` is read or written

#### Scenario: Append fails
- **WHEN** the append to `decisions.jsonl` fails
- **THEN** the command fails and the todo stays open

#### Scenario: Not an owner decision
- **WHEN** the todo has another area, or the ruling is empty
- **THEN** the command exits 1 and nothing is written

#### Scenario: List
- **WHEN** `desk decide --list` runs
- **THEN** it prints `# Rulings recorded` and the last 20 records (or `n`), oldest first, one line each: `- <date|undated>[ (<todo>)]: [<title>: ]<text>`
- **AND** with none it prints `No rulings recorded.`

### Requirement: Status JSON
`desk status --json` SHALL print one JSON object and a newline, built from the same gathered data as the
text screen and valid against `schemas/desk-status.schema.json`. Without `--json`, `desk status` SHALL
print the text screen unchanged. `--watch` SHALL take priority over `--json`.

#### Scenario: Fields
- **WHEN** `desk status --json` runs
- **THEN** the object has `v` (1), `at`, `decisions`, `active`, `claims`, `sessions`, `roots`, `branches`, `prs`, `overlaps`, `tokens` and `text`
- **AND** `sessions`, `prs`, `overlaps` and `tokens` are null when their source is unavailable or no lookup ran

#### Scenario: Parses and validates
- **WHEN** `desk status --json` runs in a desk
- **THEN** stdout parses as one JSON object that validates against the `desk-status` schema, and the command exits 0

#### Scenario: Same data as the text
- **WHEN** `desk status` and `desk status --json` run on the same desk state
- **THEN** the JSON `text` equals the text screen, apart from the time on the heading line
- **AND** the waiting decisions and claims in the JSON are the ones the text lists

#### Scenario: Sources down
- **WHEN** `gh` and the transcripts cannot be read
- **THEN** `sessions` is null, each branch's `ci` is `CI unavailable`, and the command exits 0
