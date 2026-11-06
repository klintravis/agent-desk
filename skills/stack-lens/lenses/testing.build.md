# Testing lens: build

- Test what a user of the code can observe: return values, errors, state they can read back, a request
  sent, a row written. Not private helpers, internal call order or which collaborator did the work.
- Take the expected value from the requirement, never from a run of the code under test.
- Don't mock what you can run. Mock only what you cannot run locally (a paid API, real hardware).
- One focused test per behaviour; no coverage padding, no unrelated fixture churn.
- A feature's test is its own commit before the code, with `red: <cmd> | exit <n>` in the body (`red: n/a <why>` if none is cheap).
- Never weaken an existing assertion or edit a test to match wrong code.
