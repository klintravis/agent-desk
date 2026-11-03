## MODIFIED Requirements

### Requirement: Status watch
`desk status --watch` SHALL look every 90 seconds and print only what changed, one prefixed line each.

#### Scenario: Prefixes
- **WHEN** something changes
- **THEN** the line starts with `BOARD:` (new board lines), `CI:` (a run newly completed), `AGENT+:` (a session or agent with first calls), `CTX>250k:` (peak context crossing 250k), `PR:` (a new review decision or more comments), `OVERLAP:` (a new overlapping pair) or `OWNER+:` (a new owner decision)

#### Scenario: Owner decision announced once
- **WHEN** a note on slug `owner` already starts with `T-2 `
- **THEN** a restarted watch does not print `OWNER+:` for `T-2`
- **AND** a pair or owner decision seen for the first time is posted to the board as a `note`, and never again

#### Scenario: CTX alert announced once
- **WHEN** a note on slug `ctx` already starts with `[<transcript file name>] `
- **THEN** a restarted watch does not print `CTX>250k:` for that run
- **AND** a run crossing 250k for the first time prints the line and is posted as a `note` on slug `ctx` starting with its file name, and never again

#### Scenario: Same label, new run
- **WHEN** a relaunched agent has the same label as an announced one but another transcript file
- **THEN** it prints `CTX>250k:` once when it crosses 250k

#### Scenario: Old ctx note
- **WHEN** a `ctx` note does not start with a file name in brackets
- **THEN** it matches no run and causes no error

#### Scenario: Lookup blip
- **WHEN** the CI lookup fails between two good looks
- **THEN** the last good lookup is kept and a run completed in the gap still prints `CI:` on recovery
