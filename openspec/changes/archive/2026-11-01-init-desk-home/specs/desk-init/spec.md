## MODIFIED Requirements

### Requirement: Files written
In the current folder (never `DESK_HOME`, which may name another desk), `desk init` SHALL write `desk.config.json`, `AGENTS.md`, `CLAUDE.md` (the line `@AGENTS.md`), `NEXT.md` and `agent-rules.md` (from `templates/`), empty `todo.jsonl` and `board.jsonl`, and `.gitignore`. It SHALL then write the pinned `package.json`, `TODO.md`, the `.code-workspace` file and the `desk` and `desk.cmd` shims.

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
