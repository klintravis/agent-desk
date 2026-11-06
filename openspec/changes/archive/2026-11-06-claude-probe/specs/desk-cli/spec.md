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
- **WHEN** `claude` is not on PATH, which the check reads from the spawn error `ENOENT` or the shell's exit code 9009 (cmd), or on Windows a plain 1 that `where claude` confirms, never from the shell's message text
- **THEN** its steps print `skip <name>: claude not on PATH` and do not fail the check, whatever language the shell's message is in

#### Scenario: Config that does not parse
- **WHEN** a JSON file it parses (the plugin and marketplace manifests, `hooks/hooks.json`, the desk's `desk.config.json`) is not valid JSON
- **THEN** its line is `FAIL <path>: does not parse`, the parser's message is not printed, and the run ends `desk check: <n> failed` with exit 1

#### Scenario: Config the desk refuses
- **WHEN** `desk.config.json` is valid JSON but `loadConfig` refuses it
- **THEN** its line is `FAIL <path>: <the refusal message>` and the run ends `desk check: <n> failed` with exit 1
