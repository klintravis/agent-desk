---
name: fix
description: >-
  Correction approach: reproduce a defect, find its root cause, land the smallest fix in the shared
  code, prove it with a test that failed before and passes after. Ponytail at its tightest. Use when
  a brief names the `fix` approach, or for "fix this bug", "this is broken", "regression", a failing
  check with a known or unknown cause.
---

# Fix

A correction changes behaviour that is wrong and nothing else. Ponytail's rules hold in full: the
smallest complete change, the existing structure kept. Every shipped line traces to evidence; a change
that "might help" is a guess and does not ship.

1. **Reproduce first.** Turn the report into a falsifiable claim: input or steps, what happens, what
   should happen. Reproduce it on the same surface the user hit (the test runner, the CLI, the running
   app). It won't reproduce: tighten the conditions or add logging until it does; still nothing, stop
   and report what you tried.
2. **Pin it.** Where a cheap local test path exists, write the regression test now and run it: it must
   fail, for the reason the bug gives. Commit it on its own (`test: <bug>`), before the fix. No cheap
   path: keep the repro command and its output instead, and say why there is no test.
3. **Root cause.** Ask why until the answer is a wrong decision in the code, not a consequence of an
   earlier one. Read the actual state; don't guess. If the state that broke the code is legitimate, the
   code that broke on it is the cause. If the state should never exist, find what made it: a guard where
   it surfaced hides the bug.
4. **Two failed fixes on one premise:** stop. Write the premise down in one sentence and test it
   directly before a third fix.
5. **Fix once, in the shared code.** `git grep` every caller of what you change. Fix the cause, not
   each caller. The same fault elsewhere in your scope: fix it too; outside your scope: report it.
6. **Prove it.** The test from step 2 passes; the repo's check exits 0. Paste the failing-before and
   passing-after output.

Never: weaken or edit an existing assertion to pass, add a retry, a swallowed error or a clamp that
hides the state, refactor around the fix, or add an option nobody asked for.

## Done when

- a test or repro failed before the fix and passes after, both outputs in the report;
- the fix sits where the fault is, and the diff has no unrelated change;
- the report names the root cause in one sentence and any sibling fault left out of scope.
