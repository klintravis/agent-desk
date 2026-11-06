## MODIFIED Requirements

### Requirement: Desk folder lookup
The system SHALL resolve the desk folder from `DESK_HOME` when it is set, and otherwise from the
nearest folder at or above the current directory that holds `desk.config.json`. Resolution SHALL be
lazy: importing the CLI or running `desk init` SHALL NOT need a desk.
