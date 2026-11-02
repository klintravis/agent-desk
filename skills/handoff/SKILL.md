---
name: handoff
description: >-
  Record this session's state in its todos (state, next step, decisions, one per worktree it holds)
  and record what it finished, decided or found to verify live as todos, from live state (worktrees,
  CI, the board) so the next session starts from facts. Use at the end of a session, after a merge, or
  when the user says "handoff", "where are we".
---

# Handoff

Facts come from commands, not memory. Several sessions run at once: write only what you own.
`D` below is the desk CLI: the shim `<desk>/desk` (`<desk>\desk.cmd` in PowerShell or cmd), not on
PATH and not `npx desk`. The session context names its path; it works from any folder.

1. For each repo in `desk.config.json`: `git -C <repo path> fetch -q origin` and `git worktree list`;
   then `D status`. This session is `$CLAUDE_CODE_SESSION_ID`'s first 8 chars (`owner` without one).
   Never edit or trim `board.jsonl`.
2. **Your worktrees** (claims held by this session): the state lives on the slug's active todo
   (`D todo list` shows `wt:<slug>`; the next session reads it in `D status` and `D todo show T-n`):
   - `D todo set T-n --state "<built, committed, reviewed (verdicts), uncommitted; head <sha> CI <result>>" --next "<the exact next step and stopping point, model/effort>"`
     (CI: `gh run list -R <repo gh> --commit <sha> --json conclusion,status`);
   - each ruling taken in this stream that the owner may overrule: `D todo note T-n "<ruling>"`;
     one that needs the owner first: `D todo add "<question>" --area owner --why "<options; recommendation first>"`
     (options split on `;`; the owner sees it in the mod band and answers with `/decide`);
   - only narrative that won't fit in those fields (a long investigation) goes to
     `<desk>/streams/<slug>.md`; `desk wt merge|discard` deletes it.
   If the worktree stays open, post `D board post release <slug> "handed off"`.
   **Usage** (Claude Code): paste `D tokens 24 --session self` (this session and each of its agents)
   in your final message.
3. **Shared state is todos and rulings** (default-branch shas are not written: `D status` shows them):
   - work items: `D todo done|block|note|add` for what this session finished, found blocked, decided
     or discovered;
   - owner decisions are todos (`--area owner`); a ruling is recorded only with `D decide T-n "<ruling>"`
     (closes the todo and appends it to `decisions.jsonl`);
   - things to verify live: `D todo add "<what>" --area watch`; `D todo done T-n` on a watch todo
     this session verified;
   - efficiency: run `D tokens 12`; for any agent of this session with peak context over 250k or
     fresh input over 500k, `D todo note T-n "<agent, numbers, why>"` on the session's todo.
4. Todos and stream files of other sessions: read, never edit.

If the desk folder is a git repo, commit only your files: `git -C <desk> add todo.jsonl decisions.jsonl`
(plus your `streams/<slug>.md` if you wrote one) then `commit -m "Handoff: <one line>"` with the
session's trailer.
