## MODIFIED Requirements

### Requirement: Tokens
`desk tokens [hours] [--json] [--session <id8>|self] [--by-worktree]` SHALL report the token use of the desk's main sessions and subagents, one row each, then a total line. With `--by-worktree` it SHALL print one row per worktree in place of those rows, then the same total line. Every transcript SHALL have one worktree key, worked out from the transcript and `desk.config.json` alone, never from the worktrees that exist now.

A transcript names a worktree when a path in it holds `<worktreesDir folder name>/<worktreePrefix><slug>` of a git repo in the config, ignoring case, with either path separator. The key is `<slug>`, or `<repo id>:<slug>` when the desk has more than one repo, in lower case. A transcript of no worktree has the key `(desk)`.

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
