## Why

`bin/desk.mjs` and `lib/schema.mjs` shipped about 215 lines of test code and a `--self-test` flag on `desk` and six commands, which no user needs. The checks run from a checkout of the repo through `npm test`. The owner ruled to move them to `test/` (T-185).

## What Changes

- **BREAKING**: `desk --self-test` and `desk <command> --self-test` are removed; no checks run, and each command treats the flag as its own parsing does (see the delta spec).
- Every check of `boardTest`, `todoTest`, `tokensTest`, `statusTest`, `watchTest`, `decideTest`, the `overlap` self-test and `schemaTest` moves to `test/units.test.mjs`, unchanged.
- The `report` helper and the test functions are deleted; `tokenPatterns`, `WARM_READ` and `carry` are exported for the tests.
- `scripts/docs-check.mjs` no longer special-cases `--self-test` or `*Test` functions.
- The `--self-test` modes of `scripts/merge-guard.mjs`, `scripts/edit-guard.mjs` stay.

## Capabilities

### Modified Capabilities
- `desk-cli`: the "Self-test" scenario of "Dispatch" becomes "No built-in self-tests".
- `desk-config`: lazy resolution no longer mentions `--self-test`.
