## MODIFIED Requirements

### Requirement: desk home
`desk home` SHALL print the desk folder and exit 0 when one is found and it holds `desk.config.json`, and exit 1 printing nothing otherwise.

#### Scenario: Outside a desk
- **WHEN** no `DESK_HOME` is set and no ancestor holds `desk.config.json`
- **THEN** `desk home` exits 1

#### Scenario: Stale DESK_HOME
- **WHEN** `DESK_HOME` names a folder without `desk.config.json`
- **THEN** `desk home` exits 1 printing nothing
