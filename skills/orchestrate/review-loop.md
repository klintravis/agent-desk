# Review loop and unknown cause

Read this beside `SKILL.md` at step 4 (Review and validate) of the pipeline, or when a fix has no known cause.

## Step 4 in full

The reviewer gets only the worktree path, slug, todo, approach, lenses and the model and effort it runs
at (the verdict's `by` part), never your conclusions. The validator gets the slug, todo, approach, a
scratch folder outside the worktree and the repo's install command. The structure reviewer gets the
path, slug and todo, and posts no verdict; the validator posts `FIXES NEEDED` when a claim fails.
The main reviewer gets every lens `desk lenses` printed. A lens reviewer is the same `reviewer` agent at
the `review` model and effort, briefed like the main one but with one lens: "read only
`stack-lens/lenses/<lens>.review.md`; report only findings in this lens; no repo check, CI, PR threads or docs pass, the main reviewer owns those". It posts its own verdict.
When all are back, build one **must-fix list**: every finding of every reviewer; every NOT VERIFIED claim; every
INCONCLUSIVE claim you cannot settle by a rerun, unless the owner waives it; each structure **blocker**
unless you can say in one line why it is wrong. A structure **suggest** goes on only when it deletes code
cheaply; the rest becomes a todo. The board blocks a head that any `FIXES NEEDED`, `DO NOT MERGE` or
`MERGE AFTER FIXES` verdict names, whatever is posted after it: the reviewer and the validator post
theirs; for a list item no verdict on this head covers yet (a structure blocker, a claim you reran),
post `desk board post verdict <slug> "FIXES NEEDED @<sha> <n> items"` yourself. An INCONCLUSIVE claim
later settled by a rerun, or waived by the owner, is cleared with
`desk board post verdict <slug> "MERGE @<sha> overrides: <why>"`, never to skip a fix; a `DO NOT MERGE`
needs a new commit. Fix the list with an implementer under the branch's
own approach (a structure blocker too: on a non-refactor branch it is fixed in place, or split into its
own refactor todo when it is a restructure), finish again.

**Close the loop with a fix-verification review**, not another full review: a fresh `verifier`
gets the slug, the reviewed SHA and the must-fix list verbatim, and answers only "is each item
fixed, and did the fix diff add a new defect?" with a verdict and the HEAD SHA it covers. Re-run the
`validator` first on the new head, for the claims the fixes touched or that were not VERIFIED, and give
the verifier its blocks. Whatever the verifier posts, rebuild the must-fix list from its report and the
rerun; if it is not empty, post `FIXES NEEDED` again and do another round. Write the list to
`streams/<slug>.md` under `## Must-fix @<sha>` each round (`wt merge` deletes the file), so a compaction
or the next session does not lose it. Full reviews again only if the fixes were large (new files or >~150 changed
lines). This keeps reviews converging and gives every commit on the branch a review, which the merge
gate requires.

## Unknown cause

The `debug` run reproduces, pins a failing test (committed, or left uncommitted and named in its report
when a commit hook runs the tests), finds the root cause, and reports the repro command, the test path
and the cause in one sentence. The `fix-known` brief passes those on; the implementer starts at the `fix`
skill's step 5.
