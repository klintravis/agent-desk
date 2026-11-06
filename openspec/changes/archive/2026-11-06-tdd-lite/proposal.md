## Why

Upstream TDD skills prove "red" in prose only. A feature todo can prove it mechanically: the test lands in its own commit with a receipt, and the validator reruns `accept:` on that commit (fails for the right reason) and on the head (passes). Ruling T-249: feature only; `fix` keeps its own approach.

## What Changes

- `implementer`: for a feature, commit the failing test alone as `test: <behaviour>` with body `red: <cmd> | exit <n>`, then the code; loop on the `accept:` test, full check once; escape `red: n/a <why>`.
- `orchestrate`, Approach by kind: feature approach `test-first`, validator always.
- `validate` and `proving.md`: a feature's base is the test commit; order check with `git log --name-only`; run output to a log, exit code plus 5 tail lines, `verified:` receipt only on a pass.
- `stack-lens` `testing.build.md`: one line.

## Capabilities

### Modified Capabilities
- `agents`: Approach by kind and Validator.
