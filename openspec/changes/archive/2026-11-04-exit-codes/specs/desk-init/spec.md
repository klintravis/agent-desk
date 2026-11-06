## MODIFIED Requirements

### Requirement: Flags
`desk init` SHALL accept `--repo`, `--worktrees <dir>` (default `../worktrees`), `--harness <list>` (comma separated, default `claude,copilot`; a value is required) and `--no-install`. Any other argument SHALL fail with a usage line.

#### Scenario: Unknown argument
- **WHEN** `desk init --frob` runs
- **THEN** the usage line is printed and the exit code is 1

#### Scenario: Harness without a value
- **WHEN** `desk init --harness` runs
- **THEN** an error says the flag needs a value and the exit code is 1

#### Scenario: Unknown harness
- **WHEN** `desk init --harness cluade` or `--harness claude,` runs
- **THEN** an error names the value, the exit code is 1 and nothing is written
