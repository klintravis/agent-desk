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

By approach: a **fix** claims the repro fails on the base and passes on the head; a **refactor** claims
the pinned tests and the equivalence output are the same on base and head; **perf** claims a number
against a baseline (the `perf` lens); a **feature** claims each behaviour its spec or todo promises.
In a repo with a spec workflow, each new scenario is a claim.

## Proving claims

1. Collect the claims: `accept:` notes on the todo (`desk todo show T-n`), new spec scenarios in the
   branch, and any the brief adds. None and the change alters behaviour: say so, and write the claims
   you can infer from the todo, marked *inferred*.
2. **Treatment**: run each command in the worktree at HEAD.
3. **Baseline**, for claims that compare (fix, refactor, perf): a detached copy of the base in your
   scratch folder, `git -C <worktree> worktree add --detach <scratch>/<slug>-base <base ref>`, with the
   repo's install step if the command needs it. Run the same command, same data, same environment. A
   fix's new test runs on the base too: copy the test file in, run it, expect the failure. Always remove
   it at the end: `git -C <worktree> worktree remove --force <scratch>/<slug>-base`.
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
