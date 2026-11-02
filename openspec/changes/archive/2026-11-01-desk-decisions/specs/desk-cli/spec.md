## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Decide
**Reason**: rulings no longer go to `NEXT.md` (owner ruling T-40); its heading and CRLF cases no longer apply.
**Migration**: see `Decide and rulings`; `desk sync` moves existing rulings to `decisions.jsonl`.

## ADDED Requirements

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
