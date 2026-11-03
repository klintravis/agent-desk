# desk-cli Specification

## Purpose

The `desk` entry point (`bin/desk.mjs`): dispatch, and the read-only and bookkeeping commands `status`,
`check`, `tokens`, `overlap`, `decide`, `tidy`, `settings`, `home`. The `todo` and `board` commands are specified in
`todos-and-board`; `wt`, `stream`, `init`, `sync` and `workspace` in their own specs.

## Requirements

### Requirement: Dispatch
`desk <command>` SHALL run one of `status`, `check`, `board`, `todo`, `tokens`, `overlap`, `decide`, `tidy`, `wt`, `stream`, `init`, `sync`, `workspace`, `settings`, or `home` (specified below).

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
- **WHEN** `tidy`, `wt`, `stream`, `init`, `sync`, `workspace` or `settings` has a fault
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

#### Scenario: A session's line
- **WHEN** a running session has a transcript title and claims a worktree
- **THEN** its line reads `- <title> (<id>, wt:<slug>)`, each agent on a line under it as `<type>: <about>`, and with no title the id leads the line

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
- **WHEN** a note on slug `ctx` already starts with `[<transcript file name>] `
- **THEN** a restarted watch does not print `CTX>250k:` for that run
- **AND** a run crossing 250k for the first time prints the line and is posted as a `note` on slug `ctx` starting with its file name, and never again

#### Scenario: Same label, new run
- **WHEN** a relaunched agent has the same label as an announced one but another transcript file
- **THEN** it prints `CTX>250k:` once when it crosses 250k

#### Scenario: Old ctx note
- **WHEN** a `ctx` note does not start with a file name in brackets
- **THEN** it matches no run and causes no error

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
`desk tokens [hours] [--json] [--session <id8>|self] [--by-worktree]` SHALL report the token use of the desk's main sessions and subagents, one row each, then a total line. With `--json` a main session's row SHALL also carry `title`, and a subagent's row `type` and `about`. With `--by-worktree` it SHALL print one row per worktree in place of those rows, then the same total line. Every transcript SHALL have one worktree key, worked out from the transcript and `desk.config.json` alone, never from the worktrees that exist now.

#### Scenario: Worktree key
- **WHEN** a path in a transcript holds `<worktreesDir folder name>/<worktreePrefix><slug>` of a git repo in the config, ignoring case, with either path separator
- **THEN** it names that worktree, and the key is `<slug>`, or `<repo id>:<slug>` when the config has more than one repo, in lower case
- **AND** a transcript of no worktree has the key `(desk)`

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

#### Scenario: Grouped rows
- **WHEN** `--by-worktree` is given and two transcripts have key `a` and one has key `b`, with `b` having the most fresh tokens
- **THEN** there is one row for `b` then one for `a`, each with calls, fresh tokens, output tokens and cache share summed over its transcripts
- **AND** no row has peak context or elapsed time
- **AND** the total line is the same as without the flag

#### Scenario: Grouped row without calls
- **WHEN** `--by-worktree` is given and every transcript of a key has no calls
- **THEN** that key has no row

#### Scenario: Main session in the desk
- **WHEN** a main session's first `cwd` is the desk folder and its first `type: user` row names no worktree
- **THEN** its key is `(desk)`

#### Scenario: Main session started in a worktree
- **WHEN** a main session's first `cwd` is `<worktreesDir>/<prefix>a` or a folder under it
- **THEN** its key is `a`, whatever its first `type: user` row names
- **AND** that folder does not have to exist

#### Scenario: Main session that moves
- **WHEN** a main session's first `cwd` is the desk folder and later rows have a `cwd` in worktree `a`
- **THEN** its key is `(desk)` and it counts as one transcript

#### Scenario: Stream session
- **WHEN** a main session's first `cwd` is the desk folder and its first `type: user` row names worktree `a`
- **THEN** its key is `a`

#### Scenario: Subagent brief names a worktree
- **WHEN** a subagent's first `type: user` row names worktree `a`, and its `cwd` is the desk folder or worktree `b`, and its `gitBranch` is `main`
- **THEN** its key is `a`, whatever its parent's key is

#### Scenario: Subagent brief names none
- **WHEN** a subagent's first `type: user` row names no worktree, and its parent's key is `a`
- **THEN** its key is `a`, whatever its own `cwd` is

#### Scenario: Brief names two worktrees
- **WHEN** a first `type: user` row names worktree `a` and then worktree `b`
- **THEN** the key is `a`, for a subagent and for a main session started in the desk

#### Scenario: Later rows do not count
- **WHEN** a subagent's first `type: user` row names no worktree, and a later `type: user` row names worktree `a`
- **THEN** its key is its parent's key

#### Scenario: Path spelling
- **WHEN** a brief names the worktree as `C:\x\WTS\adesk-a`, `c:/x/wts/adesk-a` or `/c/x/wts/adesk-a`, with `worktreesDir` folder `wts` and prefix `adesk-`
- **THEN** the key is `a` in each case

#### Scenario: Not a desk worktree
- **WHEN** a brief names only `wts/other-a` with no repo of prefix `other-`, or `elsewhere/adesk-a`
- **THEN** it names no worktree

#### Scenario: Several repos
- **WHEN** the desk has repos `one` and `two` with prefixes `one-` and `two-`, and a brief names `wts/two-a`
- **THEN** the key is `two:a`

#### Scenario: No repos
- **WHEN** `desk.config.json` has no repos
- **THEN** every key is `(desk)`

#### Scenario: JSON rows
- **WHEN** `--json` is given, with or without `--by-worktree`
- **THEN** it prints one row per transcript, each with its key in `worktree` and its existing fields
- **AND** the text of a brief appears nowhere in the output

#### Scenario: With a session filter
- **WHEN** `--by-worktree` and `--session <id8>` are given
- **THEN** only the transcripts of that session and its subagents are grouped

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
- **THEN** the object has `v` (2), `at`, `decisions`, `active`, `claims`, `sessions`, `roots`, `branches`, `prs`, `overlaps`, `tokens`, `user` and `text`
- **AND** `sessions`, `prs`, `overlaps` and `tokens` are null when their source is unavailable or no lookup ran
- **AND** `user` is null when no user layer is active

#### Scenario: A session's fields
- **WHEN** a session in `sessions` has a transcript title and a claim
- **THEN** it has `session`, `title`, `slug` (the claims' slugs, joined with `,`) and `agents`, and a field with no value is left out
- **AND** each agent is `{type, about}`: `type` without the plugin prefix and with the effort when known (`implementer/medium`), `about` the agent's description or empty

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

#### Scenario: Verdict kept whole
- **WHEN** a branch's newest verdict carries `by <model>/<effort>`
- **THEN** its `verdict` holds the whole text, up to the 120 characters the board stores

### Requirement: Settings command
`desk settings [--json]` SHALL print, for each task id, the resolved `model` and `effort` with the source layer of each, and for each cache key its value and source. It SHALL write nothing. With `--json` it SHALL print one JSON object holding `userFile`, `active`, `tasks`, `cache` and `warnings`, and each task SHALL hold `agent`, `task`, `model`, `effort`, `source` and `shared`. Without `--json`, warnings SHALL go to stderr as `warn <text>`.

#### Scenario: Values and sources
- **WHEN** `desk settings --json` runs with a user file setting `review.effort` to `medium`
- **THEN** `tasks.review.effort` is `medium`, `tasks.review.source.effort` is `user`, and `tasks.review.source.model` is `kit`

#### Scenario: Bad user file
- **WHEN** the user file does not parse
- **THEN** the command prints the desk's values with a warning and exits 0

#### Scenario: No desk
- **WHEN** it runs outside a desk
- **THEN** it reports the usual no-desk error and exits 1, so the skill falls back to its table

#### Scenario: Cache sources
- **WHEN** the desk's `.claude/settings.json` sets `promptCacheTtl` and the user file sets `subagentPromptCacheTtl`
- **THEN** their sources are `desk` and `user`, and a key neither sets has source `unset`

#### Scenario: Env shadows a cache key
- **WHEN** `CLAUDE_CODE_PROMPT_CACHE_TTL` or `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` is set
- **THEN** it warns that the variable takes precedence over the key

#### Scenario: Not applied yet
- **WHEN** the user's cache value differs from the desk's `.claude/settings.local.json`
- **THEN** it warns to run `desk sync`

#### Scenario: Copilot harness
- **WHEN** the `copilot` harness is configured
- **THEN** it states that model and effort are advisory on Copilot

### Requirement: User layer on the status screen
When a user layer is active, `desk status` SHALL print one line directly under its heading, naming the user file, the tasks whose resolved model or effort is below `shared`, and values a floor raised. When none is active the screen SHALL be unchanged. A problem reading the user file SHALL NOT fail the command.

#### Scenario: Cheaper review
- **WHEN** the user file lowers `review` to `sonnet` and `medium` with no floor
- **THEN** the line names `review`, `sonnet/medium` and the shared `opus/high`
- **AND** the JSON `user` holds the same entry

#### Scenario: No user layer
- **WHEN** no user file exists
- **THEN** no such line prints and `user` is null

#### Scenario: Only invalid values
- **WHEN** the user file holds no accepted value
- **THEN** no such line prints and `user` is null

### Requirement: User layer in check
Inside a desk, `desk check` SHALL print a `warn` line when a user layer is active, and one for each resolver warning. The exit code SHALL be unaffected.

#### Scenario: Active layer
- **WHEN** a user file sets a value and `desk check` runs
- **THEN** a `warn` line names the user file and the exit code is unchanged

#### Scenario: Malformed file
- **WHEN** the user file does not parse and `desk check` runs
- **THEN** a `warn` line says so and the exit code is unchanged

### Requirement: Branch protection warning in check
For each `review` repo, `desk check` SHALL read through `gh api` whether the default branch, and `main` when it differs and exists, is protected on the server, and SHALL print a line for each. These lines SHALL never fail the check or change its exit code. A desk with no `review` repo SHALL make no such call and print no such line.

#### Scenario: Protected
- **WHEN** `repos/<gh>/branches/<b>` answers `protected: true`, or `repos/<gh>/rules/branches/<b>` lists rules
- **THEN** an `ok` line names the repo and the branch

#### Scenario: Not protected
- **WHEN** the first answers `protected: false` and the second lists none
- **THEN** a `warn` line says the branch has no protection on the server and that only a server rule is a guarantee

#### Scenario: Cannot read
- **WHEN** `gh` is missing, has no token, answers 403 or does not answer within 15 seconds
- **THEN** a `warn` line says the protection cannot be read, with the reason, and that only a server rule is a guarantee

#### Scenario: Other main absent
- **WHEN** the default branch is not `main` and `main` answers 404
- **THEN** no line is printed for `main`

#### Scenario: No gh value or no origin
- **WHEN** a `review` repo has no `gh` value or no `origin`
- **THEN** a `warn` line says `wt merge` will refuse on that repo

### Requirement: Merge setting change flag in check
`desk check` SHALL warn when a repo's `merge` in the working `desk.config.json` differs from the same file at the desk folder's upstream commit (`HEAD` when it has no upstream). It SHALL never fail the check on this.

#### Scenario: Changed
- **WHEN** a repo was `review` at the upstream and is `direct` or missing in the working file, or the reverse
- **THEN** a `warn` line names the repo, the old value and the new value

#### Scenario: Desk folder not in git
- **WHEN** the desk folder is not a git repo
- **THEN** no comparison runs and nothing is printed

### Requirement: PR state on the status screen
For each open branch of a `review` repo, `desk status` SHALL show the state of its PR, and `desk status --json` SHALL give the branch row an optional `pr` with `number`, `state` and `url`. Rows of `direct` repos SHALL not change. A failed lookup SHALL leave `pr` out and SHALL NOT fail the command.

#### Scenario: Open
- **WHEN** the branch has an open PR
- **THEN** the row says PR number, open, and that a person merges

#### Scenario: Merged on the server
- **WHEN** the branch's newest PR is merged
- **THEN** the row names `desk wt merge <slug>` as the way to close

#### Scenario: Closed
- **WHEN** the newest PR is closed without merging
- **THEN** the row says so

#### Scenario: Direct repo
- **WHEN** the repo is `direct`
- **THEN** no PR lookup is added and the row's text and JSON are unchanged
