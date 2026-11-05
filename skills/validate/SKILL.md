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
- **perf**: the number against its baseline, run per the `stack-lens` skill's `lenses/perf.build.md`;
- **feature**: each behaviour its spec or todo promises, on the head.

In a repo with a spec workflow, each new scenario is a claim.

## Proving claims

The `validator` agent proves them; its steps and report format are in `proving.md` next to this file.
