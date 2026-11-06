# desk-cli Specification

## Purpose

The `desk` entry point (`bin/desk.mjs`): dispatch, and the read-only and bookkeeping commands `status`,
`check`, `tokens`, `overlap`, `lenses`, `decide`, `tidy`, `settings`, `home`. The `todo` and `board` commands are specified in
`todos-and-board`; `wt`, `stream`, `init`, `sync` and `workspace` in their own specs.

## Requirements

### Requirement: Dispatch
`desk <command>` SHALL run one of `status`, `check`, `board`, `todo`, `tokens`, `overlap`, `decide`, `lenses`, `tidy`, `wt`, `stream`, `init`, `sync`, `workspace`, `settings`, or `home` (specified below).

#### Scenario: Version
- **WHEN** `desk --version` runs
- **THEN** the kit version is printed

#### Scenario: No built-in self-tests
- **WHEN** `desk --self-test` or `desk <command> --self-test` runs
- **THEN** the CLI runs no checks: `desk --self-test`, `desk board` and `desk todo` exit 1 with the usage error, `desk status`, `desk tokens` and `desk overlap` ignore the flag and do their normal work, and `desk decide` exits 1 ("not a waiting owner decision")
- **AND** the checks live in `test/units.test.mjs`

#### Scenario: Unknown command
- **WHEN** `desk frobnicate` runs
- **THEN** a usage line listing the commands is printed and the exit code is 1

#### Scenario: Error reporting
- **WHEN** a command throws `no repo "x"`
- **THEN** stderr shows `desk <command>: no repo "x"` and the exit code is 1

#### Scenario: On-demand commands
- **WHEN** `lenses`, `tidy`, `wt`, `stream`, `init`, `sync`, `workspace` or `settings` has a fault
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
- **WHEN** `gh` cannot be read and nothing is kept for it, and the transcripts cannot be read
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
`desk check` SHALL run the kit's tests and validation and the desk's `desk.config.json` loads through `loadConfig` (so a config the desk refuses fails the check), print `ok` or `FAIL` per step, validate the desk's files against the kit's schemas as warnings, and exit 0 only when no step failed.

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
- **WHEN** `claude` is not on PATH, which the check reads from the spawn error `ENOENT` or the shell's exit code 9009 (cmd), or on Windows a plain 1 that `where claude` confirms, never from the shell's message text
- **THEN** its steps print `skip <name>: claude not on PATH` and do not fail the check, whatever language the shell's message is in

#### Scenario: Config that does not parse
- **WHEN** a JSON file it parses (the plugin and marketplace manifests, `hooks/hooks.json`, the desk's `desk.config.json`) is not valid JSON
- **THEN** its line is `FAIL <path>: does not parse`, the parser's message is not printed, and the run ends `desk check: <n> failed` with exit 1

#### Scenario: Config the desk refuses
- **WHEN** `desk.config.json` is valid JSON but `loadConfig` refuses it
- **THEN** its line is `FAIL <path>: <the refusal message>` and the run ends `desk check: <n> failed` with exit 1

#### Scenario: Desk files validated
- **WHEN** it runs inside a desk
- **THEN** `desk.config.json` and every line of `todo.jsonl`, `board.jsonl` and `decisions.jsonl` are validated against the kit's `schemas/` (a missing file is skipped)
- **AND** each bad line, including one that does not parse, prints `warn <file>:<line>: <first error>`, at most 5 per file and then `warn <file>: +N more`, and the exit code is unaffected

#### Scenario: Line without version
- **WHEN** a JSONL line has no `v`
- **THEN** no warning is printed for it

### Requirement: Tokens
`desk tokens [hours] [--json] [--session <id8>|self] [--by-worktree]` SHALL report the token use of the desk's main sessions and subagents, one row each, then a total line. With `--json` a main session's row SHALL also carry `title`, and a subagent's row `type` and `about`. With `--by-worktree` it SHALL print one row per worktree in place of those rows, then the same total line.

#### Scenario: Further rules
Every transcript SHALL have one worktree key, worked out from the transcript and `desk.config.json` alone, never from the worktrees that exist now.

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

### Requirement: A ruled owner todo is not waiting
A todo with area `owner` SHALL count as a waiting owner decision while its status is open or blocked, or while it is active and holds no `ruled:` note (the note `desk decide` writes when it closes one). A ruled one that is started for work (active) does not wait; reopened (open) or blocked it waits again, and a new ruling replaces the old one. `desk status` (its `decisions` and the owner count), `desk decide`, `desk decide --json`, the watch's `OWNER+:` lines, `desk decide T-n <ruling>` and the pane's Decisions count and Decide press SHALL all use that one set. A ruled owner todo that is active SHALL be listed with the work todos in `desk status`.

#### Scenario: Ruled, then started
- **WHEN** `T-1` (area `owner`) was ruled with `desk decide` and then `desk todo start T-1` ran
- **THEN** `T-1` is not in `decisions` of `desk status --json`, not shown by `desk decide` or `desk decide --json`, and `desk decide T-1 <ruling>` exits 1; it is listed among the status todos and in `active` (or, with a branch or claim on its slug, in Work)

#### Scenario: Ruled, started, reopened
- **WHEN** a ruled owner todo was started and is then set back to open or blocked
- **THEN** it is in `decisions` again, `desk decide T-n <ruling>` records the new ruling, and `desk decide --list` shows it

#### Scenario: Never ruled, started
- **WHEN** an owner todo with no `ruled:` note is started
- **THEN** it still counts as waiting, since the question has not been answered

### Requirement: Decide and rulings
`desk decide` SHALL show the first waiting owner decision, `desk decide --json` SHALL print the same decision as JSON, `desk decide T-n <ruling>` SHALL append the ruling to `decisions.jsonl` and close the todo, `desk decide T-n --pick <n>` SHALL do the same with the nth option's label, counted from 1 as `--json` lists them, and `desk decide --list [n]` SHALL print the recorded rulings.

#### Scenario: Further rules
`--pick` SHALL be read only as an argument of its own, never from the text of a ruling. A ruling MAY be an option's label or free text. An option's rationale SHALL NOT become part of its label. An option with an empty label SHALL NOT be listed or counted. A ruling shaped like a secret SHALL be refused, since `decisions.jsonl` is committed.

#### Scenario: Show
- **WHEN** `desk decide` runs
- **THEN** it picks the first todo with area `owner`, status open or blocked, or active with no `ruled:` note, in priority order, and prints `<id> (1 of <n>): <title>`, its context when it has stored options, the options numbered from 1, the first as `Recommended`, the rest as `Or`, each option's why on the line under it, and the answer command, which gives `desk decide <id> --pick <n>` and free words in single quotes, never in double quotes
- **AND** with none waiting it prints `No owner decisions waiting.`

#### Scenario: JSON
- **WHEN** `desk decide --json` runs
- **THEN** it prints `{id, title, context, options: [{label, why}]}` for that same decision, `context` being null when the todo has no stored options
- **AND** with none waiting it prints `null`

#### Scenario: Old todo with only a why
- **WHEN** a waiting todo has `why` and no `options`
- **THEN** the `why` is split on `;` into options after dropping a leading `Options:`, a trailing ` (recommended)` is stripped from each and the option that carried it moves first
- **AND** `Label: rationale` parts are read as label and why only when there is more than one part and every part has a distinct label of at most 60 characters, none of them `Recommended`, `other` or `or`; otherwise each part stays a whole label with no why

#### Scenario: T-151 as written
- **WHEN** the why is `Refuse (recommended): a hidden push cannot slip through, at the cost of rare false refusals, also for allowed pushes and from any directory; Allow as before: no false refusals, as the 2026-11-02 merge-policy design said, but an unparseable line can hide a push from this guard`
- **THEN** the labels are `Refuse` and `Allow as before`, and each rationale is that option's why

#### Scenario: Ruling recorded
- **WHEN** `decide T-1 "keep it"` runs for a waiting owner decision
- **THEN** a record with `todo` `T-1`, the todo's title and `text` `keep it` is appended to `decisions.jsonl`
- **AND** `T-1` is marked `done` with the note `ruled: keep it`, `Recorded T-1: keep it` and the next decision are printed, and no `NEXT.md` is read or written

#### Scenario: A ruling that reads like the flag
- **WHEN** `decide T-1 --json` runs for a waiting owner decision
- **THEN** the ruling `--json` is recorded on `T-1`
- **AND** `--pick 3` given as one argument, as the dialog and VS Code send a clicked label, is recorded as `--pick 3`, whatever option 3 holds

#### Scenario: Pick an option
- **WHEN** `decide T-1 --pick 2` runs, as two arguments, and the second option's label holds quotes and a shell command
- **THEN** that label is recorded whole, as if given as the ruling, and `T-1` is closed
- **AND** the mod's typed `/decide T-1 --pick 2` sends the flag and the number as separate arguments and does the same; typed text not starting with the flag stays one argument

#### Scenario: A pick written with =
- **WHEN** the first ruling argument starts with `--pick=`, as `decide T-1 --pick=2` or the typed `/decide T-1 --pick=2`
- **THEN** the command exits 1 saying to pick the option in the list or write the flag with a space, echoing none of the text, nothing is recorded and the todo stays open, since a shell and a clicked label send the same single argument

#### Scenario: An empty label
- **WHEN** an old todo's why is `(recommended); b`
- **THEN** `--json` lists only `b`, and `decide T-1 --pick 1` records `b`

#### Scenario: A bad pick
- **WHEN** `--pick` has no value, also as a lone argument exactly `--pick`, a value that is not a whole number or one out of range, the todo has no options, or the picked label is empty once cleaned
- **THEN** the command exits 1 with a message naming the problem, nothing is recorded and the todo stays open

#### Scenario: A ruling shaped like a secret
- **WHEN** the ruling, given as text or through `--pick`, holds a vendor key, a private key or a password in a connection string, even past the 1000-character cut
- **THEN** the command exits 1 with a message that does not repeat it, nothing is recorded and the todo stays open
- **AND** a bare `sk-` run (not `sk-ant-`) with no digit in its first 101 characters, as in `risk-based-rollout-for-every-branch`, is no vendor key and is recorded; one of 20 or more characters with a digit in its first 101 is refused, also after a literal `\n`, after `%3D` or glued to a word; `sk-ant-` plus 16 or more characters is refused with or without a digit, whatever precedes it; a look-alike the CLI refuses is masked, not refused, when it arrives as the dialog's Other text

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
`desk status --json` SHALL print one JSON object and a newline, built from the same gathered data as the text screen and valid against `schemas/desk-status.schema.json`. Without `--json`, `desk status` SHALL print the text screen unchanged. `--watch` SHALL take priority over `--json`.
A `desk status` run SHALL keep its `gh` answers in `<scratchDir>/status-gh.json`.

#### Scenario: Config the desk refuses
- **WHEN** `desk.config.json` is refused and `desk status` runs
- **THEN** the screen still prints, without roots and without claim marks, and the command does not fail on the config

#### Scenario: Further rules
With `--cached` it SHALL use the kept answers without calling `gh`, and read everything else fresh; when none can be read it SHALL ask `gh` and keep the answers, as a plain run does.
When a `gh` call fails during a plain run, the repo it was for SHALL keep its CI runs, pull requests and review-row pull requests from the kept answers (none, when nothing is kept for it), and a repo whose call succeeds SHALL replace them with the new answer, even an empty one. Each repo is judged on its own: a failing repo SHALL NOT make a kind unavailable for the others. A kind is unavailable (null) only when no repo has `gh`, or every repo's call failed and nothing is kept; a failed read SHALL NOT replace a kept answer.

#### Scenario: Fields
- **WHEN** `desk status --json` runs
- **THEN** the object has `v` (2), `at`, `decisions`, `active`, `todos`, `claims`, `sessions`, `roots`, `branches`, `prs`, `overlaps`, `tokens`, `user` and `text`
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
- **WHEN** `gh` cannot be read and nothing is kept for it, and the transcripts cannot be read
- **THEN** `sessions` is null, each branch's `ci` is `CI unavailable`, and the command exits 0

#### Scenario: Verdict kept whole
- **WHEN** a branch's newest verdict carries `by <model>/<effort>`
- **THEN** its `verdict` holds the whole text, up to the 120 characters the board stores

#### Scenario: Cached run after a plain run
- **WHEN** `desk status --json` has run, a todo is added, and `desk status --cached --json` runs
- **THEN** the second run calls `gh` zero times, shows the new todo, and has the first run's branch CI and PR state

#### Scenario: Cached run with nothing kept
- **WHEN** `desk status --cached --json` runs and `status-gh.json` is missing or torn
- **THEN** it asks `gh`, shows the answers and keeps them

#### Scenario: A failed call keeps the old answer
- **WHEN** a plain `desk status` run keeps answers, and the next run's `gh` call for one repo's CI, pull requests or review-row pull requests fails
- **THEN** that repo's kept rows of that kind stay in `status-gh.json` and in the output, and a repo whose call succeeded shows its new answer

#### Scenario: A failing repo with nothing kept
- **WHEN** nothing is kept, and one repo's `gh` call for a kind fails while another's succeeds
- **THEN** the succeeding repo's rows of that kind are shown and kept, and the kind is not null

#### Scenario: An empty answer replaces
- **WHEN** a repo's `gh` call succeeds with no rows
- **THEN** that repo's kept rows of that kind are gone

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
When a user layer is active, `desk status` SHALL print one line directly under its heading, naming the user file, the tasks whose resolved model or effort is below `shared`, and values of the user file a floor raised. When none is active the screen SHALL be unchanged. A problem reading the user file SHALL NOT fail the command.

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
For each open branch of a `review` repo, `desk status` SHALL show the state of its PR, and `desk status --json` SHALL give the branch row an optional `pr` with `number`, `state`, `url` and, for a merged PR that does not hold the branch's head, `stale: true`. Rows of `direct` repos SHALL not change. A failed lookup SHALL leave `pr` out and SHALL NOT fail the command.

#### Scenario: Open
- **WHEN** the branch has an open PR
- **THEN** the row says PR number, open, and that a person merges

#### Scenario: Merged on the server
- **WHEN** the branch's newest PR is merged and holds the branch's head (its head, or a commit on top of it)
- **THEN** the row names `desk wt merge <slug>` as the way to close

#### Scenario: Merged, but not this head
- **WHEN** the newest PR is merged and does not hold the branch's head
- **THEN** the row says the PR is merged without naming `desk wt merge`, and `--json` marks the `pr` with `stale: true`

#### Scenario: Fork PR with the same branch name
- **WHEN** an open PR from a fork has the branch's name
- **THEN** its comments, threads and review decision do not fill the branch's PR review row

#### Scenario: Closed
- **WHEN** the newest PR is closed without merging
- **THEN** the row says so

#### Scenario: Direct repo
- **WHEN** the repo is `direct`
- **THEN** no PR lookup is added and the row's text and JSON are unchanged

### Requirement: Tokens call count
An assistant line whose model starts with `<` (for example `<synthetic>`) SHALL NOT count as a call: the client wrote it, not the API.

#### Scenario: Synthetic lines
- **WHEN** a transcript has one assistant line with a `requestId` and two with model `<synthetic>` and zero usage
- **THEN** it counts as one call

### Requirement: Tokens compaction copies
An all-zero assistant line with the `requestId` of a call already counted SHALL NOT change that call: a compaction copies earlier lines this way.

#### Scenario: Compaction copy
- **WHEN** a transcript has a call with usage, then a later line with the same `requestId` and zero usage
- **THEN** it counts as one call with the first line's usage

### Requirement: Tokens nesting and patterns
`desk tokens --json` rows SHALL carry `depth`, `parent`, `firstFresh` and `firstRead`, and a subagent row with calls and a timestamp SHALL carry `sinceSpawn`. The listing without `--by-worktree` SHALL show depth and parent per row, and, when a subagent has calls, one line with runs, nested runs, first-call share of fresh tokens and cache reads per call, and one line with warm starts by gap, both before the total line.

#### Scenario: Depth and parent
- **WHEN** a subagent's `.meta.json` has `spawnDepth` and `parentAgentId`
- **THEN** its row has that `depth` and `parent`
- **AND** a main session's row has depth 0 and an empty parent
- **AND** a subagent with no parent in its metadata has parent `main`, and depth 1 when `spawnDepth` is missing too

#### Scenario: First call
- **WHEN** a transcript has calls
- **THEN** `firstFresh` is the input plus cache write of its first call and `firstRead` that call's cache read

#### Scenario: Gap since the last spawn
- **WHEN** rows of the window have the same agent type, ignoring effort, and the same model
- **THEN** `sinceSpawn` is the seconds since the previous one started, across sessions, and null on the first

#### Scenario: Warm starts
- **WHEN** the listing runs and a subagent has calls
- **THEN** each subagent counts in one of `<5m`, `5-60m`, `>60m` or `first` by `sinceSpawn`, as warm when `firstRead` is at least 5000

#### Scenario: Total stays last
- **WHEN** the pattern lines print
- **THEN** the total line is still the last line
- **AND** `--by-worktree` prints neither pattern line nor the depth and parent columns

### Requirement: Branch state in status JSON
Each branch of `desk status --json` SHALL carry `state`, computed once in the CLI, in the order the State order scenario gives.

#### Scenario: State order
`CI failed` when a run of the head sha did not pass, `fixes needed` for an on-head `FIXES`, `DO NOT` or `MERGE AFTER` verdict (the newest, or any the merge gate counts), `rebase` when behind, then `not pushed` when the repo has an origin and `origin/<branch>` is not the head, then `ready` only when every run of the head sha passed (or the repo has no gh) and the merge gate's `mergeOk` holds, else `needs review`; with CI not yet decided `CI running`, `CI stale` (runs, none on the head), `no CI yet` or `CI unknown` (lookup failed). It SHALL add `verdictOld: true` when the newest verdict names another commit.

#### Scenario: Several runs of the head
- **WHEN** one run of the head sha succeeded and another failed
- **THEN** `state` is `CI failed`, whichever run is newest

#### Scenario: Ready is the merge gate
- **WHEN** CI passed on the head and the newest verdict is `MERGE @<head>`
- **THEN** `state` is `ready`; with a verdict on another commit or none it is `needs review`

### Requirement: Options in the status JSON
Each entry of `decisions` in `desk status --json` SHALL hold `options`, read the same way as `desk decide --json`. `v` SHALL stay 2.

#### Scenario: A decision with options
- **WHEN** a waiting decision has two options
- **THEN** its entry is `{id, title, options: [{label, why}, {label, why}]}` and the object still has `v` 2

### Requirement: Todos in the status JSON
`desk status --json` SHALL hold `todos`: every todo with status open, active or blocked, except a waiting owner decision (area `owner`, open or blocked, or active with no `ruled:` note; a ruled one that is active is listed), except area `idea` unless it is active, and except an active todo whose slug has an open branch or an open claim (that todo is in Work), ordered active first, then by priority, then id (a surface that shows only the first few never hides an active todo). `v` SHALL stay 2 and the printed screen SHALL not change.

#### Scenario: What is not started
- **WHEN** todos are open, blocked or in area `watch`
- **THEN** each is in `todos`

#### Scenario: Decisions and ideas
- **WHEN** a todo is a waiting owner decision, or has area `idea` and is not active
- **THEN** it is not in `todos`

#### Scenario: An active idea
- **WHEN** a todo in area `idea` is active and its slug has no open branch or claim
- **THEN** it is in `todos`

#### Scenario: A todo in Work
- **WHEN** an active todo's slug has an open branch or claim
- **THEN** it is in `active` and not in `todos`

#### Scenario: Active with nowhere to show
- **WHEN** an active todo has no slug, or its slug has no open branch or claim
- **THEN** it is in `active` and in `todos`, so it is shown once

#### Scenario: Nothing open
- **WHEN** no todo qualifies
- **THEN** `todos` is an empty list and the object still has `v` 2

### Requirement: Settings warning for an unignored local file
`desk settings` SHALL report that the desk's `.claude/settings.local.json` is not ignored by git, so the user's cache settings are not written to it, in its `warnings`, and SHALL NOT print it separately. It SHALL do so only when the desk has the `claude` harness.

#### Scenario: Not ignored, JSON
- **WHEN** `desk settings --json` runs, the desk has the `claude` harness, the user file has cache keys and the desk's `.claude/settings.local.json` is not ignored by git
- **THEN** `warnings` holds one entry naming the file as not ignored by git, and stderr holds no such line

#### Scenario: Not ignored, plain
- **WHEN** the same runs without `--json`
- **THEN** stderr holds that warning once as `warn <text>`

#### Scenario: Not ignored, without the claude harness
- **WHEN** the same runs on a desk whose harnesses are `copilot` only
- **THEN** `warnings` holds no such entry

### Requirement: Lenses
`desk lenses <slug> [--json]` SHALL print one line `<lens>: <reason>` for each `stack-lens` lens that the open worktree `<slug>` matches, in the table's order, and nothing when none matches; `--json` SHALL print the same as an array of `{ lens, why }`. The rules in `lib/lenses.mjs` SHALL carry the table's lens names in its order.

#### Scenario: What is matched
- **WHEN** the lenses of a worktree are computed
- **THEN** a path regex runs on every changed file (as `desk overlap` counts them), a regex on the added lines of code files (never Markdown, JSON, YAML or other prose and data files), and the kind of the open todo with that slug (`fix` brings `testing`, `perf` brings `perf`)
- **AND** the reason is the first match (`kind fix`, a path, or `<path> adds <text>`), then `(+N)` for the rest

#### Scenario: Files by path
- **WHEN** the worktree changed `lib/a.ts`, `test/x.test.mjs` and `hooks/redact.ts`
- **THEN** the lines are `typescript: lib/a.ts (+1)`, `testing: test/x.test.mjs` and `security: hooks/redact.ts`

#### Scenario: Kind fix
- **WHEN** the todo with the slug has kind `fix` and the worktree changed only `lib/a.ts`
- **THEN** the lines are `typescript: lib/a.ts` and `testing: kind fix`

#### Scenario: Added lines
- **WHEN** a commit adds `spawnSync(` to `lib/wt.mjs` and the word `secret` to a skill's `SKILL.md`
- **THEN** `security: lib/wt.mjs adds spawnSync(` is printed and the `SKILL.md` line counts for no lens

#### Scenario: No match or no worktree
- **WHEN** the worktree changed only `README.md` under a `feature` todo
- **THEN** nothing is printed and the exit code is 0
- **AND** `desk lenses nosuch` exits 1 with `desk lenses: no worktree "nosuch"`

### Requirement: Config warning on the status screen
When `desk.config.json` is refused, `desk status` SHALL print `Warning: ` and the refusal message on a line directly under its heading, and `desk status --json` SHALL carry the messages in `warnings`, an array of strings valid against `schemas/desk-status.schema.json`. `warnings` SHALL be absent when the config loads. The command SHALL still exit 0.

#### Scenario: Unknown key
- **WHEN** `desk.config.json` holds an unknown top-level key and `desk status` runs
- **THEN** the screen has a `Warning:` line naming the key, and the exit code is 0
- **AND** `desk status --json` has `warnings` holding the same message

#### Scenario: Valid config
- **WHEN** the config loads
- **THEN** no `Warning:` line prints and `warnings` is absent

### Requirement: GitHub budget on the status screen
A plain `desk status` run SHALL reuse the kept `status-gh.json` without calling `gh` while that file is under 55 seconds old, so several instances share one round a minute. When it asks, it SHALL first read `gh api rate_limit`; when `core` or `graphql` has under 20% remaining it SHALL make no other `gh` call, use the kept answers (none when nothing is kept), and add a warning naming each low budget and its reset time as local `HH:MM`, on the screen and in `warnings`. When `rate_limit` cannot be read it SHALL ask as usual.
For open pull requests it SHALL list them with `updatedAt` each round and ask for comments, reviews and review threads only for a pull request whose `updatedAt` or review decision differs from the kept row, keeping the kept row for the others. The pull request rows it prints SHALL be the same as before.

#### Scenario: Two runs within the minute
- **WHEN** `desk status` runs, and runs again 10 seconds later
- **THEN** the second run makes no `gh` call and shows the first run's answers

#### Scenario: A pull request that did not change
- **WHEN** a round finds an open pull request with the `updatedAt` and review decision kept for it
- **THEN** only the list query runs for it, and its row is the kept one

#### Scenario: A pull request that changed
- **WHEN** a round finds an open pull request whose `updatedAt` differs from the kept row, or whose kept row has none
- **THEN** its comments, reviews and threads are asked and the row is replaced

#### Scenario: Low budget
- **WHEN** `gh api rate_limit` reports under 20% remaining for `graphql` and a round is due
- **THEN** the only `gh` call is `api rate_limit`, the kept answers show, and a `Warning:` line names `graphql` and its reset time

#### Scenario: Budget unreadable
- **WHEN** `gh api rate_limit` fails
- **THEN** the round runs as it did and no budget warning shows
