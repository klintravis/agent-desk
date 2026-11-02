## MODIFIED Requirements

### Requirement: Dispatch
`desk <command>` SHALL run one of `status`, `check`, `board`, `todo`, `tokens`, `overlap`, `decide`, `wt`, `stream`, `init`, `sync`, `workspace`, or `home` (specified below).

#### Scenario: Version
- **WHEN** `desk --version` runs
- **THEN** the kit version is printed

#### Scenario: Self-test
- **WHEN** `desk --self-test` runs
- **THEN** the built-in self-tests of board, todo, tokens, status, watch and decide run
- **AND** it prints `ok` and exits 0, or prints `FAIL` and the failed checks and exits 1

#### Scenario: Unknown command
- **WHEN** `desk frobnicate` runs
- **THEN** a usage line listing the commands is printed and the exit code is 1

#### Scenario: Error reporting
- **WHEN** a command throws `no repo "x"`
- **THEN** stderr shows `desk <command>: no repo "x"` and the exit code is 1

#### Scenario: On-demand commands
- **WHEN** `wt`, `stream`, `init`, `sync` or `workspace` has a fault
- **THEN** it loads on demand, so `status` still works
