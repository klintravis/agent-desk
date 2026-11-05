---
name: validate
description: >-
  Prove a change does what it claims with fresh evidence: each acceptance claim made falsifiable,
  run on the base and on the head, compared, and judged VERIFIED, NOT VERIFIED or INCONCLUSIVE. Also
  how to write acceptance claims at plan time. Use for "validate", "verify this", "prove it works",
  "did this fix it", and in the `validator` agent.
---

# Validate

Validation is not a recap and not a review. It runs the real thing and compares. A passing test suite
shows the tests pass; it does not show the bug is gone or the feature works for its user.

## Writing claims (plan time)

Every todo that changes behaviour gets at least one acceptance claim before implementation, as a note:

`desk todo note T-n "accept: <claim> | <command> | <expected>"`

- **claim**: falsifiable, with a condition and a threshold: "an empty cart charges nothing", not "checkout works".
- **command**: one command that shows it (a test, a CLI call, a curl, a script path the implementer will add).
- **expected**: what the output must show: an exit code, a line, a number with its limit.

What each kind must prove (this is the one list; the orchestrator and the validator both use it):

- **fix**: the repro or new test fails on the base and passes on the head;
- **refactor**: the pinned tests and the equivalence output are the same on the base and the head, and
  no pinned test was edited after the commit that pinned it (`git diff <pin commit>..HEAD -- <test paths>`
  lists any; each needs the implementer's reason);
- **perf**: the number against its baseline, run per the `perf` lens of the `stack-lens` skill;
- **feature**: each behaviour its spec or todo promises, on the head.

In a repo with a spec workflow, each new scenario is a claim.

## Proving claims

1. Collect the claims: `accept:` notes on the todo (`desk todo show T-n`), new spec scenarios in the
   branch, and any the brief adds. None and the change alters behaviour: say so, and write the claims
   you can infer from the todo, marked *inferred*.
2. **Treatment**: a detached copy of the head in your scratch folder, never the worktree itself (other
   agents read it meanwhile): `git -C <worktree> worktree add --detach <scratch>/<slug>-head HEAD`, the
   repo's install step if the command needs it, then each command there.
3. **Baseline**, for kinds that compare (fix, refactor, perf): the same with `<scratch>/<slug>-base` at
   the base ref. Same command, same data, same environment. Tests and scripts the branch added (a fix's
   new test, a refactor's pins and equivalence script) don't exist on the base: copy them in from the
   head first. Always remove both copies at the end, even after a failure:
   `git -C <worktree> worktree remove --force <scratch>/<slug>-<head|base>`.
4. Compare the raw outputs, not your memory of them. Run anything timing-sensitive at least 3 times.
5. Judge each claim:
   - **VERIFIED**: the outputs differ (or match, for a refactor) exactly as claimed, with no confound;
   - **NOT VERIFIED**: unchanged, wrong direction, or short of the threshold;
   - **INCONCLUSIVE**: no valid baseline, a noisy signal, a failed run, or an environment difference.

Never soften a NOT VERIFIED. Never mark a claim VERIFIED from a test name, a log line or the
implementer's report: only from output you produced in this run.

## Report

One block per claim:

```
VERIFIED | NOT VERIFIED | INCONCLUSIVE   <claim>
  command: <command>
  base: <output that matters, or n/a>   head: <output that matters>
  why: <one line: the evidence and any confound>
```

End with `Validation: <n> verified, <m> not verified, <k> inconclusive @<head sha>`.
