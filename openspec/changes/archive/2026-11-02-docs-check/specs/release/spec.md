## ADDED Requirements

### Requirement: Docs drift check
`npm test` SHALL run `scripts/docs-check.mjs`, which reads commands, actions and flags from the code and fails when the README or `openspec/inventory.md` disagrees, and fails rather than passes when it cannot parse the code.

#### Scenario: Docs match the code
- **WHEN** the README's relative links resolve, its Node version matches `engines`, and the Commands table, README and inventory list what the code has
- **THEN** it prints `docs-check: ok` and exits 0

#### Scenario: A flag is undocumented
- **WHEN** a handler reads a flag that is in neither its Commands row nor a README section the row links
- **THEN** it prints `desk <command>: <flag> in <file>, not in README.md` and exits 1

#### Scenario: Git arguments
- **WHEN** a handler passes `--porcelain` or `--ff-only` to git
- **THEN** they are not counted as flags of the command

#### Scenario: Parser blind
- **WHEN** `const COMMANDS = {...}` in `bin/desk.mjs` cannot be parsed, or a handler function cannot be found
- **THEN** it reports a gap instead of passing

#### Scenario: Missing files
- **WHEN** `README.md` is missing from the checkout, or `openspec/inventory.md` is missing while `bin/desk.mjs` exists
- **THEN** it reports a gap and exits 1

#### Scenario: Scope
- **WHEN** the check reads documentation links and versions
- **THEN** it reads `README.md` only, not `docs/`, the CHANGELOG or openspec
