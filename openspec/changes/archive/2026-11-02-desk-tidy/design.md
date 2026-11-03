## Context

What the code does today, which the decisions below rely on:

- `owner` on a todo is display only. `desk todo start` sets it, `desk todo list` prints it for active todos, and the
  Desk pane uses it as a label. Nothing gates on it; the board's `claim` is what holds a worktree. So clearing it blocks
  nobody and loses only a label, and the note keeps the old value.
- `from` on a line is the author of that line: the first 8 characters of `CLAUDE_CODE_SESSION_ID`, or `owner`. It is
  history and is never rewritten.
- `desk status` lists as running a session whose transcript was written in the last 10 minutes (`RUNNING_MIN`). That is a
  display; nobody can conclude death from it.
- Transcripts are `~/.claude/projects/<folder>/<session id>.jsonl`, with subagents in
  `<session id>/subagents/*.jsonl`. `desk tokens` finds the desk's folders with `isDeskProject` and uses the first 8
  characters of the file name as the session id, which is what `from` and `owner` hold.
- `desk wt merge|discard` deletes the slug's stream file but no scratch file. `desk stream` writes exactly three scratch
  files per slug, and a `--desk` stream has a slug but no worktree and posts its claim as `desk-<slug>`.
- A board claim is open only while its worktree exists (`openClaims`).
- `streams/` and `scratch/` are gitignored in a new desk, so a deleted file does not come back from git.
- `desk workspace` does not list stream files, so tidy need not refresh the workspace file.

## Goals / Non-Goals

**Goals:**
- One command, safe to run from any session and from a shell with no session.
- Writes only what can be proved safe; every other finding reaches the owner at most once.
- `bin/desk.mjs` barely changes.

**Non-Goals:**
- Closing a todo, for any reason.
- Removing lines from `todo.jsonl`: it is append-only and done todos are already hidden from `desk todo list`.
- Writing `board.jsonl`.
- Calling tidy from `desk wt merge`. Merge already closes the slug's todos and deletes its stream file, and its scratch
  files cannot be deleted for 24 hours anyway; the next handoff collects them.
- Config keys for the thresholds, a schema for `--json` (`desk tokens --json` has none), acting on a ruling, and
  hand-editing generated `.github/skills` copies (`desk sync` writes them).

## Decisions

**Dead needs positive evidence.** The rule requires a transcript that exists and is old, plus no open claim. A missing
transcript means unknown, because it is the normal case on a Copilot desk, on another machine, for a session started
outside the desk's folders, under `CLAUDE_CONFIG_DIR`, and possibly after pruning. Alternative: treat missing as dead; it
would clear live sessions everywhere Claude Code is not the harness.

**24 hours, beside and not instead of `RUNNING_MIN`.** Ten minutes answers "is it writing now" for a display. Clearing
needs "is it gone", and an owner away for lunch or overnight must survive. A session idle past 24 hours that comes back
loses a label until its next `desk todo start`, so the threshold need not be longer. Named constant next to the other
tidy constant in `lib/tidy.mjs`. Subagent transcripts count, because a session waiting on a long agent has a stale main
transcript.

**Open claims use `openClaims`.** Same definition as `desk board claims`, so the two cannot disagree. A claim on a
removed worktree does not protect, and the transcript age still does. A `--desk` stream's `desk-<slug>` claim is not
open by this definition, so such a session is protected by its fresh transcript instead.

**Stat only.** `tokenRows` reads whole transcripts for tokens; liveness needs a directory listing and `mtime`, which keeps
tidy fast enough for every handoff. `tokenRows` is not reused for that reason; the folder filter `isDeskProject` is.

**Clearing writes `owner: ""` and a note.** The fold keeps later values per field, an empty string renders as no owner in
the list and in the pane, and the schema allows it. Deleting the field is impossible in an append-only file. Status stays
(owner ruling 1 in the proposal).

**The exception to "write only what you own".** The rule exists so that a session's judgement does not overwrite another
session's work. Tidy applies no judgement: a CLI rule, a proved-dead session, one display field, and the old value kept
in a note. The skills say so and say an agent never does this by hand.

**Orphans need four independent guards.** The name pattern alone is not enough, since `scratchDir` is configurable and
the folders can hold a person's files. No worktree and no open todo show the work is over; a failed stream's log stays
while its todo is open, which is when someone needs it. Age keeps it clear of a running detached stream, whose log is
being written. History proves the slug is the desk's: `streams/notes.md` with no board or todo line is a person's file.
`desk-<slug>` counts as history so that logs of `--desk` streams do not stay forever. A missing worktrees folder (moved
drive, wrong config) makes `worktreeList` return nothing, which would otherwise make every slug look orphaned, so tidy
deletes nothing then. Alternative: move files to a trash folder; that is more code and just another folder to tidy.

**Review candidates come from structured fields only.** Slug, `merged` board lines, children, area and `updated`. No text
matching: free text cannot prove anything, and the word "trigger" also appears in todos parked on nothing.

**Marker on the owner todo, not its title.** `source: "tidy"` and `tidyIds` are ordinary extra fields, which the todo schema
already allows, and `desk todo show` prints them. Duplicate detection reads the marker, so a reworded title cannot break
it. The `why` follows the format `/decide` already splits on `;`.

**No board note.** `desk status --watch` already announces a new owner todo and posts its own note, and `desk status` and
the band list it. Tidy's output and the todo notes are the record of the rest.

**Placement.** `lib/tidy.mjs`, loaded with the existing `lazy` helper; it imports `read`, `openClaims`, `todos`, `OPEN`,
`nextId` and `writeTodo` from `bin/desk.mjs` as `lib/wt.mjs` does, and `flags` from `lib/wt.mjs`. `writeTodo` needs an
`export`; it writes `from: me()`, which is `owner` outside a session, so tidy needs no session. `--json` matches `desk
status --json` and `desk tokens --json`.

## Risks / Trade-offs

- [A deleted file is unrecoverable] → Four guards, a fixed list of names, top level only, and a report that shows the same list before any `--apply`.
- [Handoff runs `--apply` unattended, so a wrong rule acts without a person] → The two fixes are limited to a display field and proven leftovers; everything else only asks.
- [The first run on an old desk clears many owners and raises a long owner question] → One line each and one todo; the next run has nothing to do.
- [Transcripts are pruned, so the oldest owners stay unknown] → Listed in the report and harmless, since `owner` gates nothing (owner ruling 4 in the proposal).
- [A session resumed after 24 hours finds its owner cleared] → `desk todo start` retakes it; its claim, `state` and `next` are untouched.
- [Two sessions run `--apply` together and both raise an owner todo or write a clear line] → Same race as `nextId`; accepted with a `shortcut:` comment. A duplicate is visible and costs one `/decide`.
- [Two sessions share the first 8 characters of an id] → Newest `mtime` wins, which errs towards not dead.
- [A candidate list grows without a new question because the open tidy todo waits] → `desk tidy` always shows the full list; the next question comes after the ruling.

## Migration Plan

None. New command, no data format change. To back out, remove the command and the skill lines; extra fields on todos are ignored.

## Open Questions

None. The owner's choices are in `proposal.md` under Owner rulings; this design and the tasks follow them.
