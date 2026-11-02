## MODIFIED Requirements

### Requirement: Status watch
`desk status --watch` SHALL look every 90 seconds and print only what changed, one prefixed line each.

#### Scenario: CTX alert announced once
- **WHEN** a note on slug `ctx` already starts with `<session> <agent> `
- **THEN** a restarted watch does not print `CTX>250k:` for that agent
- **AND** an agent crossing 250k for the first time prints the line and is posted as a `note` on slug `ctx`, and never again
