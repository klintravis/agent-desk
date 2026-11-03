## Why

Every merge moves `develop`, so each open branch must rebase, rerun CI and be verified again at its new head (`wt merge` needs fast-forward, green CI and a verdict `MERGE @<head sha>`). Done by hand, most rebases changed only context (T-112).

## What Changes

- New `desk wt rebase <slug> [--no-wait]`: refuses a dirty worktree, fetches, rebases on `origin/<defaultBranch>`, then runs the `wt finish --rebased` path (check, force-with-lease push, CI wait and report).
- A conflict aborts the rebase: the worktree is back at its old head and the message says how to rebase by hand.
- It runs `git range-diff` between the reviewed commit (the sha of the slug's newest board verdict, else the head before the rebase, said so) and the new head, and reports whether only context changed or which commits differ, with the old and new head.
- No verdict is posted and the merge gate is unchanged. Exit is non-zero on a refusal, a conflict, a failed check or red CI.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: new `wt rebase`.

## Decisions

- Already up to date means the local head equals origin's head: it then prints the message and exits 0 with no CI wait. An unmoved head origin lacks is checked and pushed.
- The repo's `check` stays before the push (it reuses `finish`); no flag to skip it.
- A newest verdict that is `FIXES NEEDED @<sha>` counts as the reviewed commit like a `MERGE` one; the report names the verdict word.
