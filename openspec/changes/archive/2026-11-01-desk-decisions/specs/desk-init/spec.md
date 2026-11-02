## MODIFIED Requirements

### Requirement: Files written
In the current folder (never `DESK_HOME`, which may name another desk), `desk init` SHALL write `desk.config.json`, `AGENTS.md`, `CLAUDE.md` (the line `@AGENTS.md`) and `agent-rules.md` (from `templates/`), empty `todo.jsonl`, `board.jsonl` and `decisions.jsonl`, and `.gitignore`. It SHALL then write the pinned `package.json`, the `.code-workspace` file and the `desk` and `desk.cmd` shims. It SHALL write no `NEXT.md` and no `TODO.md`.

#### Scenario: Reported
- **WHEN** a file is written
- **THEN** `wrote <path>` is printed

#### Scenario: Config content
- **WHEN** `desk.config.json` is written
- **THEN** it holds the kit version, `worktreesDir`, `scratchDir` `scratch`, `repos`, `harnesses` and `permissions` with empty `deny` and `additionalDirectories`

#### Scenario: Older desk rules
- **WHEN** `.claude/agent-rules.md` exists
- **THEN** no `agent-rules.md` is written

#### Scenario: DESK_HOME names another desk
- **WHEN** `DESK_HOME` is set to a different desk and `desk init` runs in another folder
- **THEN** every file is written in the current folder and the `DESK_HOME` desk is not touched

#### Scenario: No Markdown state files
- **WHEN** `desk init` runs in an empty folder
- **THEN** neither `NEXT.md` nor `TODO.md` exists afterwards

### Requirement: Never overwrite
An existing file in the `files` map (`desk.config.json`, `AGENTS.md`, `CLAUDE.md`, `agent-rules.md`, `todo.jsonl`, `board.jsonl`, `decisions.jsonl`, `.gitignore`) or `package.json` SHALL be kept and reported as `kept <path>`. The `folders` list of the `.code-workspace` file (its settings are kept) SHALL be refreshed on every run.

#### Scenario: Second run
- **WHEN** `desk init` runs again in a desk
- **THEN** the `files` map entries and `package.json` are reported `kept` and none changes, while the workspace `folders` list and the shims are written again
