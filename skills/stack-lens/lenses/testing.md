# Testing lens

## Build

- Test what a user of the code can observe: return values, errors, state they can read back, a request
  sent, a row written. Not private helpers, internal call order or which collaborator did the work.
- Take the expected value from the requirement, never from a run of the code under test.
- Don't mock what you can run. Mock only what you cannot run locally (a paid API, real hardware).
- One focused test per behaviour; no coverage padding, no unrelated fixture churn.
- Never weaken an existing assertion or edit a test to match wrong code.

## Review

Judge each new or changed test with two imagined edits. **Break the behaviour** (wrong value, skipped
effect, effect done twice): if the test still passes, it proves nothing — a finding. **Change only the
internals**: if the test would fail, it is pinned to the implementation — a finding when a simpler
behavioural test would do. Also a finding: an assertion on data the test built itself, or a restated
constant that never runs the code that reads it.
