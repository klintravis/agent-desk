## MODIFIED Requirements

### Requirement: Check
`desk check` SHALL run the kit's tests and validation and the desk's `desk.config.json` loads through `loadConfig` (so a config the desk refuses fails the check), print `ok` or `FAIL` per step, validate the desk's files against the kit's schemas as warnings, and exit 0 only when no step failed.

#### Scenario: Steps
- **WHEN** `desk check` runs
- **THEN** it runs in order the kit's `test/*.test.mjs` (skipped with `skip kit tests: not shipped` when `test/` is absent), the `subagent-context` script, `claude plugin test` and `claude plugin validate` on the kit, then parses `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json` and the desk's `desk.config.json`

#### Scenario: Result
- **WHEN** every step is ok
- **THEN** it prints `desk check: all ok` and exits 0
- **AND** otherwise it prints `desk check: <n> failed` and exits 1

#### Scenario: Subagent context
- **WHEN** it runs inside a desk
- **THEN** `subagent-context` must print additional context
- **AND** outside a desk it passes with the empty `{}` answer

#### Scenario: Version drift
- **WHEN** `desk.config.json` records `kitVersion` `0.0.9` and the installed kit is `0.1.0`
- **THEN** a `warn` line points at `CHANGELOG.md` and `desk sync`, and the exit code is unaffected

#### Scenario: Missing tool
- **WHEN** `claude` is not on PATH
- **THEN** its steps print `skip <name>: claude not on PATH` and do not fail the check

#### Scenario: Desk files validated
- **WHEN** it runs inside a desk
- **THEN** `desk.config.json` and every line of `todo.jsonl`, `board.jsonl` and `decisions.jsonl` are validated against the kit's `schemas/` (a missing file is skipped)
- **AND** each bad line, including one that does not parse, prints `warn <file>:<line>: <first error>`, at most 5 per file and then `warn <file>: +N more`, and the exit code is unaffected

#### Scenario: Line without version
- **WHEN** a JSONL line has no `v`
- **THEN** no warning is printed for it
