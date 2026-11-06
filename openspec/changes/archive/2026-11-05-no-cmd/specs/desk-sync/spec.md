## MODIFIED Requirements

### Requirement: Shims
`desk sync` SHALL write `desk` (sh) in the desk folder; it sets `DESK_HOME` and runs the pinned kit's `bin/desk.mjs` with the arguments. It SHALL write no `desk.cmd`, and SHALL delete one that carries the marker `written by desk sync`. A file of that name without the marker SHALL be left alone with a warning and no change to the exit code.

#### Scenario: Foreign file
- **WHEN** `desk` exists and lacks the marker
- **THEN** it is not rewritten and a warning names it

#### Scenario: Old desk.cmd
- **WHEN** `desk.cmd` exists and carries the marker
- **THEN** `desk sync` deletes it

#### Scenario: Foreign desk.cmd
- **WHEN** `desk.cmd` exists and lacks the marker
- **THEN** it is kept, a warning names it and the exit code stays 0

### Requirement: Plumbing hidden in VS Code
`desk sync` and `desk workspace` SHALL add `files.exclude` entries set to `true` to the desk folder's `.vscode/settings.json` for `desk`, `node_modules`, `package.json`, `package-lock.json`, `.github`, `.claude`, `.gitignore`, `*.code-workspace` and `NEXT.md.bak`. They SHALL skip `.claude` when the desk keeps its rules at `.claude/agent-rules.md`, and SHALL NOT put the excludes in the `.code-workspace` file.

#### Scenario: Excludes written
- **WHEN** `desk sync` runs and `.vscode/settings.json` is missing
- **THEN** it holds `files.exclude` with the nine entries `true`
