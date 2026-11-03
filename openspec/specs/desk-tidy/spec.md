# desk-tidy Specification

## Purpose
`desk tidy` closes out what finished work leaves behind so the desk stays quiet: it reports leftovers, clears ownership
of dead sessions and deletes proven orphans on request, and hands everything else to the owner as one question.

## Requirements

### Requirement: Report by default
`desk tidy` SHALL only report and write nothing. The report SHALL list dead owners, unknown owners, orphan files, kept
files and folders, stray worktree folders and review candidates, each with its reason. A missing `todo.jsonl`, `board.jsonl`, `streams` folder, scratch folder
or transcript folder SHALL count as empty. An unknown flag or a positional argument SHALL be an error.

#### Scenario: Report writes nothing
- **WHEN** `desk tidy` runs on a desk with a dead owner, an orphan file and a stale todo
- **THEN** all three are listed
- **AND** `todo.jsonl`, `board.jsonl`, `streams/` and the scratch folder are unchanged

#### Scenario: Nothing to do
- **WHEN** `desk tidy` runs on a desk with no leftovers
- **THEN** it prints one line saying nothing to tidy and exits 0

#### Scenario: Unknown flag
- **WHEN** `desk tidy --force` runs
- **THEN** stderr names the flag, the exit code is 1 and nothing is written

### Requirement: JSON report
`desk tidy --json` SHALL print the report as one JSON object with the keys `dead`, `unknownOwners`, `orphans`, `kept`,
`strayFolders`, `candidates` and `applied`. `applied` SHALL be empty without `--apply`.

#### Scenario: JSON report
- **WHEN** `desk tidy --json` runs
- **THEN** stdout is one JSON object with those keys and `applied` is empty

### Requirement: Dead session
A session SHALL count as dead only when a todo's `owner` names it, the value is not the literal `owner`, no open claim
that `desk board claims` lists has it in `from`, a transcript of it exists, and the newest modification time among its
transcripts and its subagents' transcripts is 24 hours or more ago. The `from` of a todo's lines is history and SHALL NOT
decide ownership.

#### Scenario: Old transcript, no claim
- **WHEN** a todo's owner has no open claim and its transcript was last written 25 hours ago
- **THEN** that session is dead

#### Scenario: Away for an hour
- **WHEN** a todo's owner has no open claim and its transcript was last written 1 hour ago
- **THEN** that session is not dead, although `desk status` does not list it as running

#### Scenario: Open claim
- **WHEN** a todo's owner has an open claim and its transcript was last written 30 days ago
- **THEN** that session is not dead

#### Scenario: A subagent is still writing
- **WHEN** a session's main transcript is 25 hours old and one of its subagents' transcripts is 1 hour old
- **THEN** that session is not dead

#### Scenario: Named owner
- **WHEN** a todo's owner is `owner`
- **THEN** that owner is never dead and is not listed

### Requirement: Finding transcripts
Tidy SHALL look for transcripts in the Claude Code project folders of this desk (the desk, its repos and worktrees, as
for `desk tokens`), matching the first 8 characters of the file name. No transcript found SHALL mean unknown, and unknown
SHALL NOT mean dead. Tidy SHALL read only names and modification times of transcripts, never their content.

#### Scenario: Unknown transcript
- **WHEN** a todo's owner has no transcript in any project folder of this desk
- **THEN** the owner is listed as unknown and is not dead

#### Scenario: Transcript outside the desk
- **WHEN** a todo's owner has a transcript only in another project's folder
- **THEN** the owner is listed as unknown and is not dead

#### Scenario: Desk without transcripts
- **WHEN** tidy runs with no Claude Code project folder, as on a Copilot-only desk or outside any session
- **THEN** it completes, nothing counts as dead, and orphan handling and review candidates still work

### Requirement: Clearing ownership
`desk tidy --apply` SHALL clear `owner` on each open, active or blocked todo whose owner is dead, by appending one line
to `todo.jsonl` that sets `owner` to an empty string and adds a note naming the old owner and the transcript's age. It
SHALL change no other field, and SHALL write nothing for a todo with no owner or for a done or dropped todo.

#### Scenario: Owner cleared
- **WHEN** `desk tidy --apply` runs and active T-1 has a dead owner
- **THEN** T-1 has an empty `owner`, is still active, keeps its `state` and `next`, and has a note naming the old owner

#### Scenario: Second run
- **WHEN** `desk tidy --apply` runs twice
- **THEN** the second run appends no line for T-1

#### Scenario: Done todo
- **WHEN** a done todo has a dead owner
- **THEN** no line is written for it

#### Scenario: Taking over
- **WHEN** a session runs `desk todo start T-1` after the owner was cleared
- **THEN** that session is T-1's owner as usual

### Requirement: Orphan candidates
Tidy SHALL consider only regular files directly inside their folder, never recursively and never a link, named
`<desk>/streams/<slug>.md`, `<scratchDir>/<slug>-prompt.txt`, `<scratchDir>/<slug>-run.jsonl` or
`<scratchDir>/<slug>-run.jsonl.err`, where `<slug>` is a valid slug. Any other file SHALL NOT be listed or deleted.

#### Scenario: Other files
- **WHEN** the scratch folder holds `report.txt`, `old-run.log`, `Bad_Name-run.jsonl` and `sub/old-run.jsonl`
- **THEN** none of them is listed or deleted

### Requirement: Orphan guards
A candidate SHALL be an orphan only when the worktrees folder exists, no repo has a worktree with that slug, no open,
active or blocked todo has that slug, the file was last modified 24 hours or more ago, and the slug has a history: a board
line or any todo carries the slug, or a board line carries `desk-<slug>`. A candidate failing a guard SHALL be listed as
kept with the reason, unless it has a worktree or an open todo, which is normal and not listed.

#### Scenario: Worktree still there
- **WHEN** `streams/live.md` is 30 days old and slug `live` has a worktree
- **THEN** it is not an orphan

#### Scenario: Open todo protects a failed stream's log
- **WHEN** `old-run.jsonl` is 30 days old, slug `old` has no worktree and an open todo has slug `old`
- **THEN** it is not an orphan

#### Scenario: Too recent
- **WHEN** a candidate meets every other condition and is 1 hour old
- **THEN** it is kept and listed with the reason

#### Scenario: A file with no history
- **WHEN** `streams/notes.md` is 30 days old and no board line or todo carries `notes`
- **THEN** it is kept and listed as not provably the desk's own

#### Scenario: A desk stream's history
- **WHEN** `old-run.jsonl` meets the other conditions and the only board line for it carries `desk-old`
- **THEN** it is an orphan

#### Scenario: Worktrees folder missing
- **WHEN** the worktrees folder does not exist
- **THEN** every candidate is kept and listed, because the absence of a worktree proves nothing

### Requirement: Deleting orphans
`desk tidy --apply` SHALL delete orphans and no other file. A delete that fails, such as a file held open on Windows,
SHALL be reported and SHALL NOT stop the run or change the exit code.

#### Scenario: Stream file with no worktree
- **WHEN** `streams/old.md` is 25 hours old, slug `old` has no worktree and no open todo, and the board has a line for `old`
- **THEN** `--apply` deletes it

#### Scenario: Stream logs of a merged slug
- **WHEN** `old-prompt.txt`, `old-run.jsonl` and `old-run.jsonl.err` meet the same conditions in the scratch folder
- **THEN** `--apply` deletes all three

#### Scenario: File held open
- **WHEN** deleting an orphan fails
- **THEN** the failure is reported, the remaining fixes run and the exit code stays 0

### Requirement: Review candidates are never closed
Tidy SHALL list finished, stale and watch todos as review candidates and SHALL NOT change their status, by flag or
otherwise. A todo SHALL be listed once, under the first of these that applies.

#### Scenario: Status unchanged
- **WHEN** `desk tidy --apply` runs on a desk with a finished, a stale and a watch candidate
- **THEN** all three keep their status

### Requirement: Finished candidates
A todo that is open, active or blocked SHALL be finished when its slug has a `merged` board line and no worktree, or when
it has at least one child and all its children are done or dropped.

#### Scenario: Merged slug left open
- **WHEN** T-2 is open with slug `s`, the board has a `merged` line for `s` and `s` has no worktree
- **THEN** T-2 is listed as finished

#### Scenario: All children closed
- **WHEN** T-3 is open and its two children are done and dropped
- **THEN** T-3 is listed as finished

### Requirement: Stale and watch candidates
A todo that is open, active or blocked and not in area `owner`, `idea` or `watch` SHALL be stale when it was not updated
for 14 days, has no open claim on its slug and has no open child; a note counts as an update. A todo parked on a
condition that has not happened is stale like any other. An open todo in area `watch` not updated for 14 days SHALL be
listed as watch.

#### Scenario: Old todo
- **WHEN** T-4 is open in area `a` and was last updated 15 days ago
- **THEN** T-4 is listed as stale

#### Scenario: Held or split
- **WHEN** an old todo's slug has an open claim, or an old todo has an open child
- **THEN** it is not listed as stale

#### Scenario: Ideas and owner decisions
- **WHEN** todos in area `idea` and area `owner` were last updated 90 days ago
- **THEN** neither is listed

#### Scenario: Old watch todo
- **WHEN** an open `watch` todo was last updated 15 days ago
- **THEN** it is listed as watch

### Requirement: One batched owner question
`desk tidy --apply` SHALL raise at most one owner todo for the review candidates: area `owner`, field `source` set to
`tidy`, field `tidyIds` holding the comma-separated ids, a summary, a title with the count, and a `why` whose options split
on `;` with the recommendation first. Tidy SHALL NOT act on the ruling. Owners and orphans SHALL NOT be part of the question.

#### Scenario: First run
- **WHEN** `desk tidy --apply` finds two candidates
- **THEN** one owner todo with `source` `tidy` names both

#### Scenario: Nothing to ask
- **WHEN** `desk tidy --apply` finds no candidates
- **THEN** no owner todo is added

#### Scenario: A ruling is not acted on
- **WHEN** the owner rules on the tidy todo and `desk tidy --apply` runs again
- **THEN** the todos it named keep their status

### Requirement: The owner question is not repeated
Tidy SHALL raise nothing while a todo with `source` `tidy` is open, and SHALL NOT update that todo. It SHALL ask only about
candidates that no earlier todo with `source` `tidy` named, in any status, and raise nothing when no candidate is new. A
plain `desk tidy` SHALL always list every current candidate.

#### Scenario: One already open
- **WHEN** a todo with `source` `tidy` is open and `desk tidy --apply` finds a new candidate
- **THEN** no owner todo is added

#### Scenario: Owner chose to keep them
- **WHEN** the earlier tidy todo was ruled and closed, and the same candidates are still listed
- **THEN** no owner todo is added and `desk tidy` still lists them

#### Scenario: A new candidate after a ruling
- **WHEN** the earlier tidy todo was closed and one candidate is new
- **THEN** one owner todo is added naming only the new id

### Requirement: The board stays as it is
Tidy SHALL read `board.jsonl` and SHALL NOT write it: no trimming, no edit and no note, since the owner question already
reaches `desk status` and `desk status --watch` through its todo.

#### Scenario: Board untouched
- **WHEN** `desk tidy --apply` clears an owner, deletes an orphan and raises an owner todo
- **THEN** `board.jsonl` is byte-identical

### Requirement: Tidy in handoff and kickoff
The `handoff` skill SHALL run `desk tidy --apply` before its commit, and the `kickoff` skill SHALL run `desk tidy` as a
report while gathering facts and SHALL NOT apply fixes. Both skills SHALL keep their rule that a session writes only what
it owns and SHALL state the one exception: `desk tidy --apply` applies a fixed rule to other sessions' `owner` fields and
orphan files, and an agent SHALL NOT make such a change by hand.

#### Scenario: Handoff
- **WHEN** a session follows the `handoff` skill
- **THEN** it runs `desk tidy --apply` before committing `todo.jsonl`

#### Scenario: Kickoff
- **WHEN** a session follows the `kickoff` skill
- **THEN** it runs `desk tidy` without `--apply` and carries candidates into its plan as proposals for the owner

### Requirement: Stray worktree folders
Tidy SHALL list a directory directly in the worktrees folder as stray when its name is a configured git repo's
`worktreePrefix` followed by a valid slug and no configured git repo's `git worktree list` names that path. A directory
matching no prefix, or a file, SHALL NOT be listed. When `git worktree list` fails for a repo, that repo's folders SHALL be
listed as kept with the reason, not as stray. Tidy SHALL NOT delete, move or write into a stray folder, with or without
`--apply`. The JSON report SHALL carry them under `strayFolders`.

#### Scenario: Leftover folder
- **WHEN** the worktrees folder holds `a-gone`, which `git worktree list` of repo `a` does not name
- **THEN** it is listed as stray and `--apply` leaves it and its files in place

#### Scenario: Known worktree
- **WHEN** the folder is a worktree that `git worktree list` names
- **THEN** it is not listed

#### Scenario: Listing fails
- **WHEN** `git worktree list` fails for repo `a`
- **THEN** its folders are kept with the reason and none is stray

#### Scenario: Foreign folder
- **WHEN** the worktrees folder holds `notes` matching no repo prefix
- **THEN** it is not listed
