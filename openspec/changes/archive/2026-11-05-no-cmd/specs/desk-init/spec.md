## MODIFIED Requirements

### Requirement: Files written
In the current folder (never `DESK_HOME`, which may name another desk), `desk init` SHALL write `desk.config.json`, `AGENTS.md`, `CLAUDE.md` (the line `@AGENTS.md`) and `agent-rules.md` (from `templates/`), empty `todo.jsonl`, `board.jsonl` and `decisions.jsonl`, and `.gitignore`. It SHALL then write the pinned `package.json`, the `.code-workspace` file and the `desk` shim. It SHALL write no `desk.cmd`, no `NEXT.md` and no `TODO.md`.

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

### Requirement: Shims
A `desk` shim carrying the `written by desk sync` marker SHALL be rewritten. One without the marker (or a folder of that name) SHALL be left alone with a `warn <path> exists and is not the desk shim; not rewritten` line, and the exit code SHALL be 1. A `desk.cmd` is handled by `desk sync` (see desk-sync, Shims).

#### Scenario: Foreign shim
- **WHEN** a `desk` file without the marker exists
- **THEN** it is not rewritten, a `warn` line is printed and the exit code is 1
