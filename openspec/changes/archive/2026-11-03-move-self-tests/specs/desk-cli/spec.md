## MODIFIED Requirements

### Requirement: Dispatch
`desk <command>` SHALL run one of `status`, `check`, `board`, `todo`, `tokens`, `overlap`, `decide`, `tidy`, `wt`, `stream`, `init`, `sync`, `workspace`, `settings`, or `home` (specified below).

#### Scenario: No built-in self-tests
- **WHEN** `desk --self-test` or `desk <command> --self-test` runs
- **THEN** the CLI runs no checks: `desk --self-test`, `desk board` and `desk todo` exit 1 with the usage error, `desk status`, `desk tokens` and `desk overlap` ignore the flag and do their normal work, and `desk decide` exits 1 ("not a waiting owner decision")
- **AND** the checks live in `test/units.test.mjs`
