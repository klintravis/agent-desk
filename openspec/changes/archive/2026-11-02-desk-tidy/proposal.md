## Why

A desk collects leftovers. Todos keep the `owner` of sessions that ended long ago, stream files and stream logs
outlive their worktrees (`desk wt merge` deletes the stream file but no scratch file), and todos whose work is over
stay open until someone notices. Today a session finds these by hand and the owner gets one-off questions such as
"close these six?". `handoff` forbids a session from touching what others wrote, so a dead session's ownership stays
forever. The owner asked for one step, run at handoff and at other points, that keeps the desk quiet (T-86), with
this split: report by default, `--apply` fixes only dead-session ownership and stale leftovers, and anything else
that could close becomes one batched owner question.

## What Changes

- New command `desk tidy`. Without flags it only reports and writes nothing. `--json` gives the same report as JSON.
- `desk tidy --apply` makes two kinds of fix and nothing else:
  - clears `owner` on an open todo whose owning session is dead. Dead is strict: not the literal `owner`, no open
    claim on the board, and a transcript that exists and was last written 24 hours or more ago. An unknown transcript
    is never dead, so a desk without Claude transcripts clears nothing;
  - deletes orphans: `<desk>/streams/<slug>.md` and the three files `desk stream` writes to the scratch folder, only
    when the slug has no worktree, no open todo, a history on the board or in the todos, and the file is 24 hours old.
- Todos that look finished, stale or forgotten on watch are never closed by tidy. They are reported, and `--apply`
  raises at most one batched owner todo, marked as tidy's own, with no duplicate while one is open.
- `board.jsonl` is read, never written. Done todos stay in `todo.jsonl`.
- `skills/handoff/SKILL.md` runs `desk tidy --apply`; `skills/kickoff/SKILL.md` runs `desk tidy` as a report. Both
  skills state the one exception to "write only what you own".
- No breaking change. Nothing runs tidy except these two skills and a person typing it.

## Capabilities

### New Capabilities

- `desk-tidy`: the report, the definition of a dead session and of an orphan, what `--apply` may change, and the batched owner question.

### Modified Capabilities

- `desk-cli`: Dispatch lists `tidy` as a command that loads on demand.

## Impact

- New `lib/tidy.mjs`, new `test/tidy.test.mjs`; `bin/desk.mjs` gets one `COMMANDS` entry and exports `writeTodo`; `package.json` adds the test file to its explicit list.
- `skills/handoff/SKILL.md`, `skills/kickoff/SKILL.md`, `templates/AGENTS.md`, `README.md`, `CHANGELOG.md`, `openspec/inventory.md`.
- Deletes files that git cannot bring back: `streams/` and `scratch/` are gitignored by default. Hence the guards.
- Existing desks: no migration. The first `--apply` on an old desk may clear several owners and raise one owner todo.

## Owner rulings

Ruled by the owner on 2026-11-02. The other artifacts follow them.

1. **Clearing a dead session's ownership changes only `owner`; the status stays as is.** An `active` todo with a
   handed-off worktree stays `active` with its `state` and `next`, and `desk todo start` takes it over.
2. **No "unfired trigger" category.** No field records one; it exists only as free text in notes. Such a todo shows up
   as stale after 14 days with its id and title.
3. **Never re-ask about a todo the owner kept.** Tidy raises only ids that no earlier tidy todo named, so a "keep" ruling
   sticks, and a later `desk tidy` still lists them.
4. **A missing transcript means unknown: list it, never clear it.** Claude Code may prune old transcripts (not verified
   here), and other machines' transcripts are never visible. The oldest owners may never clear; `owner` is display only,
   so nothing is blocked.
5. **Orphans and scratch logs may be deleted at 24 hours.** A failed stream's log survives while its todo is open, which
   is the case someone still needs it.
6. **Thresholds are named constants (24 hours, 14 days), not config.**
