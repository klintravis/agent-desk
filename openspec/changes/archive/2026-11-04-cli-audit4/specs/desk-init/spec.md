## MODIFIED Requirements

### Requirement: Repo entries
`desk init --repo <id>=<path>` (repeatable) SHALL add one `repos` entry per flag. `<id>` SHALL be lowercase letters, digits and dashes and SHALL NOT repeat, and `<path>` SHALL exist (resolved against the desk folder); a bare `--repo <id>` means the desk folder itself. The stored path SHALL use forward slashes, relative to the desk folder, except that the desk folder itself SHALL be stored as `.` and a path on another drive stays absolute. A path holding no `.git` SHALL become `kind: "folder"`.

#### Scenario: Plain folder
- **WHEN** the path has no `.git`
- **THEN** the entry is `{ id, kind: "folder", path }`

#### Scenario: The desk folder itself
- **WHEN** `--repo me=.` (or a bare `--repo me`) runs
- **THEN** the entry's path is `.`

#### Scenario: Invalid repo
- **WHEN** the id has an uppercase letter or the path does not exist
- **THEN** init fails with an error naming it and the exit code is 1

#### Scenario: Repeated id
- **WHEN** two `--repo` flags name the same id
- **THEN** init fails with an error naming it, the exit code is 1 and no file is written

### Requirement: Flags
`desk init` SHALL accept `--repo`, `--worktrees <dir>` (default `../worktrees`), `--harness <list>` (comma separated, default `claude,copilot`; a value is required) and `--no-install`. Any other argument SHALL fail with a usage line.

#### Scenario: Unknown argument
- **WHEN** `desk init --frob` runs
- **THEN** the usage line is printed and the exit code is 1

#### Scenario: Harness without a value
- **WHEN** `desk init --harness` runs
- **THEN** an error says the flag needs a value and the exit code is 1

### Requirement: Never overwrite
An existing file in the `files` map (`desk.config.json`, `AGENTS.md`, `CLAUDE.md`, `agent-rules.md`, `todo.jsonl`, `board.jsonl`, `decisions.jsonl`, `.gitignore`) or `package.json` SHALL be kept and reported as `kept <path>`. A kept `.gitignore` SHALL additionally print a `warn` line naming the lines of the desk's own `.gitignore` it lacks. An existing `package.json` SHALL be read with a leading byte-order mark ignored. The `folders` list of the `.code-workspace` file (its settings are kept) SHALL be refreshed on every run.

#### Scenario: Second run
- **WHEN** `desk init` runs again in a desk
- **THEN** the `files` map entries and `package.json` are reported `kept` and none changes, while the workspace `folders` list and the shims are written again

#### Scenario: Older .gitignore
- **WHEN** `.gitignore` exists without `board.jsonl`
- **THEN** it is not changed and a `warn` line names `board.jsonl` among the missing lines
