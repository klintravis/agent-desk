# Proving claims

The validator's steps; the claim format and what each kind proves are in `SKILL.md` beside this file.

1. Collect the claims: `accept:` notes on the todo (`desk todo show T-n`), new spec scenarios in the
   branch, and any the brief adds. None and the change alters behaviour: say so, and write the claims
   you can infer from the todo, marked *inferred*.
2. **Treatment**: a detached copy of the head in your scratch folder, never the worktree itself (other
   agents read it meanwhile): `git -C <worktree> worktree add --detach <scratch>/<slug>-head HEAD`, the
   repo's `copy` paths from `desk.config.json` copied in from its main checkout, its install step if the
   command needs it, then each command there.
3. **Baseline**, for kinds that compare (fix, refactor, perf): the same with `<scratch>/<slug>-base` at
   the base ref. Same command, same data, same environment. Tests and scripts the branch added (a fix's
   new test, a refactor's pins and equivalence script) don't exist on the base: copy them in from the
   head first. Always remove both copies at the end, even after a failure:
   `git -C <worktree> worktree remove --force <scratch>/<slug>-<head|base>`.
   **Feature**: the base is the test commit, found by its receipt (`git log --grep '^red:' origin/<default>..HEAD`;
   no match is NOT VERIFIED). `git log --name-only --reverse origin/<default>..HEAD` must show the test
   commit, touching only tests, before the first non-test commit. The command must exit non-zero on the
   test commit on the behaviour's assertion, not "module not found", and exit 0 on the head. When the
   receipt is `red: n/a <why>` (`new module` is valid when no assertion can fail before the module
   exists), skip the test-commit run and the order check, judge the why, and still run the head.
   Run each command as `{ <cmd>; } > <scratch>/run.log 2>&1; echo "exit $?"; tail -5 <scratch>/run.log`;
   report `verified: <cmd> | exit 0` only on a pass.
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
