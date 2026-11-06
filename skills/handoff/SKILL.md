---
name: handoff
description: >-
  Record this session's state in its todos (state, next step, decisions, one per worktree it holds)
  and record what it finished, decided or found to verify live as todos, from live state (worktrees,
  CI, the board) so the next session starts from facts. Use at the end of a session, after a merge, or
  when the user says "handoff", "where are we".
---

# Handoff

Several sessions run at once: write only what you own. The one exception is `desk tidy --apply`, which applies a fixed
rule to other sessions' `owner` fields and orphan files; never make such a change by hand.
`D` below is the desk CLI, run as the session context names it.

1. `D status --fetch` (it fetches every repo). This session is `$CLAUDE_CODE_SESSION_ID`'s first 8 chars (`owner` without one).
   Never edit or trim `board.jsonl`.
2. **Your worktrees** (claims held by this session): the state lives on the slug's active todo
   (`D todo list` shows `wt:<slug>`; the next session reads it in `D status` and `D todo show T-n`):
   - `D wt handoff <slug> --next "<the exact next step and stopping point, task id>"` writes the todo's
     `state` from facts (head, clean or not, pushed, CI, the verdict without its `by` part) and posts
     `release`; add what the facts don't say (built but unreviewed, a finding half fixed) as a note;
     a must-fix list in progress stays in `streams/<slug>.md`;
   - each ruling taken in this stream that the owner may overrule: `D todo note T-n "<ruling>"`;
     one that needs the owner first: an `--area owner` todo (`--why`, 2-4 `--option`s: recommendation
     first; the owner answers with `/decide`);
   - what overflows the note caps (design notes, rejected options, `Ruling:` lines, links to spec, PR or
     commits; references, never copies) goes to `<desk>/context/T-n.md`, linked once by
     `D todo note T-n "context: context/T-n.md"`. It is data, versioned only if the desk commits it;
   - only narrative that won't fit in those fields (a long investigation) goes to
     `<desk>/streams/<slug>.md`; `desk wt merge|discard` deletes it.
   A worktree whose row says `desk wt merge <slug> to close` in `D status` (repo with `merge: "review"`): run `D wt merge <slug>` to close it.
   **Usage** (Claude Code): paste `D tokens 24 --session self` (this session and each of its agents)
   in your final message.
3. **Shared state is todos and rulings**:
   - work items: `D todo done|block|note|add` for what this session finished, found blocked, decided
     or discovered;
   - owner decisions are todos (`--area owner`); a ruling is recorded only with the `decide` skill, or
     `D decide T-n --pick <n>` and, for the owner's own words, `D decide T-n '<ruling>'` in single quotes
     (closes the todo and appends it to `decisions.jsonl`);
   - things to verify live: `D todo add "<what>" --area watch`; `D todo done T-n` on a watch todo
     this session verified;
   - every new todo gets `--summary "<about 50 characters>"`;
   - efficiency: run `D tokens 12`; for any agent of this session with peak context over 250k or
     fresh input over 500k, `D todo note T-n "<agent, numbers, why>"` on the session's todo.
4. Todos and stream files of other sessions: read, never edit by hand; only `D tidy --apply` in step 5 changes them.
5. **Tidy**: run `D tidy --apply` and relay what it did (owners cleared, files deleted, any question raised). It closes
   no todo and does not write the board.

If the desk folder is a git repo, commit only your files: `git -C <desk> add todo.jsonl decisions.jsonl`
(plus your `context/T-n.md` or `streams/<slug>.md` if you wrote one) then `commit -m "Handoff: <one line>"`.
