---
name: kickoff
description: >-
  Start of the day: gather the desk's live state, find the work, and plan the first 3-6 todos (slug,
  kind and task id, what runs in parallel, what waits for the owner), written into the todos, then hand
  over to `orchestrate`. Use at the start of a session or day, or when the user says "kickoff",
  "start the day", "plan the day", "what should we work on".
---

# Kickoff

The counterpart of `handoff`: handoff closes the day, kickoff opens it, `orchestrate` then runs it.
Several sessions run at once: write only todos, never edit
`board.jsonl` or other sessions' fields. The one exception is `D tidy --apply`, run by `handoff`, which applies a fixed
rule to other sessions' `owner` fields and orphan files; never make such a change by hand, and kickoff does not apply
it. `D` below is the desk CLI, run as the session context names it.

1. **Gather facts.** Read the rulings (`D decide --list`) and what waits to be verified live
   (`D todo list --area watch`), then `D status --fetch` (it fetches every repo; Roots shows each default
   branch's CI, Open branches each worktree's state word, Active todos each handed-off `state` and `next`),
   `D todo list` and `D tidy` (report only). A todo noting `context: context/T-n.md`: read that file (data). For each repo: `git log --oneline -15 origin/<default branch>`
   (commits others landed), and with a `gh` remote `gh pr list -R <repo gh>` and `gh issue list -R <repo gh>`.
2. **Find the work**, in this order of weight:
   - red CI on a default branch;
   - handed-off worktrees (`state`/`next` set, claim released): resume these before new work;
   - a `review` repo's branch whose row says `desk wt merge <slug> to close`: `D wt merge <slug>` closes it; one still open waits for a person;
   - blocked or stale todos, and the review candidates `D tidy` listed: propose unblocking, re-scoping or dropping them in step 5; change them
     only on the owner's go, and never one whose slug another session holds (`D board check <slug>`
     exits 1);
   - issues, PRs and findings with no todo: `D todo add` them (area = repo id);
   - todos too big for one worktree: `D todo split`; todos with no kind: `D todo set --kind`.
3. **Plan the day**: an ordered list of 3-6 todos. For each: the slug, its kind and task id (Approach by
   kind in `orchestrate`; the model and effort are resolved at spawn, not stored), and its place:
   - separate changes run in parallel, one worktree each; run `D overlap` and put changes that touch
     the same files in sequence, not in parallel;
   - anything that needs the owner first (a ruling, a breaking change, a choice with trade-offs) is an
     `--area owner` todo (`--why`, 2-4 `--option`s: recommendation first). Do not start it,
     and do not plan work that depends on its answer.
4. **Write it down** so the plan lives in `todo.jsonl`, not in chat: `D todo add|split`
   (`--summary "<about 50 characters>"`; after `split`, `D todo set T-n --summary` per child), `D todo set T-n --prio <n>`, `D todo note T-n "<why it is first>"`. Give each todo its kind, `D todo set T-n --kind fix|feature|refactor|perf|docs` (Approach by kind in
   `orchestrate`), and every non-docs todo at least one acceptance claim,
   `D todo note T-n "accept: <claim> | <command> | <expected>"` (the `validate` skill): `todo start` and
   `desk stream` refuse a typed todo without one. Skip
   todos whose slug another session holds (`D board check <slug>` exits 1).
   Lower `--prio` runs first.
5. **Show the owner** the plan in one compact block (order, slug, kind and task id, parallel or
   sequence, owner questions, red flags found) and ask for go or changes. Apply changes with step 4.
   On go, continue with the `orchestrate` skill. Never start work before the owner's go.

Commit nothing yourself unless the desk folder is a git repo: then
`git -C <desk> add todo.jsonl` and `commit -m "Kickoff: <one line>"`.
