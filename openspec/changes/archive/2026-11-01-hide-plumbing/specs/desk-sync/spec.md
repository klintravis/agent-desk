## ADDED Requirements

### Requirement: Plumbing hidden in VS Code
`desk sync` and `desk workspace` SHALL add `files.exclude` entries set to `true` to the desk folder's `.vscode/settings.json` for `desk`, `desk.cmd`, `node_modules`, `package.json`, `package-lock.json`, `.github`, `.claude`, `.gitignore`, `*.code-workspace` and `NEXT.md.bak`. They SHALL keep every other key and every `files.exclude` entry already present (a `false` included), write nothing when all are present, skip `.claude` when the desk keeps its rules at `.claude/agent-rules.md`, and leave a file that is not plain JSON unchanged with a warning and without failing the command. They SHALL NOT put the excludes in the `.code-workspace` file.

#### Scenario: Excludes written
- **WHEN** `desk sync` runs and `.vscode/settings.json` is missing
- **THEN** it holds `files.exclude` with the ten entries `true`

#### Scenario: User choice kept
- **WHEN** the file has another key and `"package.json": false`
- **THEN** both survive and a second run changes nothing
