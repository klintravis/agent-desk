## ADDED Requirements

### Requirement: Scripts run through a link
`scripts/release.mjs`, `scripts/docs-check.mjs`, `scripts/gh-review-live.mjs` and `bin/desk.mjs` SHALL run their command when started through a symlink or junction, and SHALL NOT exit 0 silently.

#### Scenario: Started through a junction
- **WHEN** `node <junction>/release.mjs publish` runs with no tag
- **THEN** it prints the usage error and exits 1
