# desk-init Specification

## Purpose
`desk init` makes a folder a desk: it detects the repos, writes the desk's files without overwriting its content and pins the kit. Implemented in `lib/init.mjs`.

## Requirements

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

### Requirement: Git repo entries
A path holding `.git` SHALL become `kind: "git"` with `gh` (the GitHub `owner/name` of `origin`, else empty), `defaultBranch` (`origin/HEAD`, else the checked-out branch, else `main`), `worktreePrefix` `<id>-`, `branchPrefix` `agent/` and empty `install`, `build` and `check`.

#### Scenario: Default branch
- **WHEN** the checkout has no `origin/HEAD`
- **THEN** `defaultBranch` is the checked-out branch, else `main`

#### Scenario: Git checkout
- **WHEN** `--repo app=../app` names a checkout whose `origin` is `git@github.com:you/app.git`
- **THEN** the entry has `kind: "git"` and `gh: "you/app"`

### Requirement: Flags
`desk init` SHALL accept `--repo`, `--worktrees <dir>` (default `../worktrees`), `--harness <list>` (comma separated, default `claude,copilot`; a value is required) and `--no-install`. Any other argument SHALL fail with a usage line.

#### Scenario: Unknown argument
- **WHEN** `desk init --frob` runs
- **THEN** the usage line is printed and the exit code is 1

#### Scenario: Harness without a value
- **WHEN** `desk init --harness` runs
- **THEN** an error says the flag needs a value and the exit code is 1

#### Scenario: Unknown harness
- **WHEN** `desk init --harness cluade` or `--harness claude,` runs
- **THEN** an error names the value, the exit code is 1 and nothing is written

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

### Requirement: Never overwrite
An existing file in the `files` map (`desk.config.json`, `AGENTS.md`, `CLAUDE.md`, `agent-rules.md`, `todo.jsonl`, `board.jsonl`, `decisions.jsonl`, `.gitignore`) or `package.json` SHALL be kept and reported as `kept <path>`. A kept `.gitignore` SHALL additionally print a `warn` line naming the lines of the desk's own `.gitignore` it lacks. An existing `package.json` SHALL be read with a leading byte-order mark ignored.

#### Scenario: Further rules
The `folders` list of the `.code-workspace` file (its settings are kept) SHALL be refreshed on every run.

#### Scenario: Second run
- **WHEN** `desk init` runs again in a desk
- **THEN** the `files` map entries and `package.json` are reported `kept` and none changes, while the workspace `folders` list and the shims are written again

#### Scenario: Older .gitignore
- **WHEN** `.gitignore` exists without `board.jsonl`
- **THEN** it is not changed and a `warn` line names `board.jsonl` among the missing lines

### Requirement: Shims
A `desk` shim carrying the `written by desk sync` marker SHALL be rewritten. One without the marker (or a folder of that name) SHALL be left alone with a `warn <path> exists and is not the desk shim; not rewritten` line, and the exit code SHALL be 1. A `desk.cmd` is handled by `desk sync` (see desk-sync, Shims).

#### Scenario: Foreign shim
- **WHEN** a `desk` file without the marker exists
- **THEN** it is not rewritten, a `warn` line is printed and the exit code is 1

### Requirement: Kit pin
`package.json` SHALL get the devDependency `agent-desk` at `github:klintravis/agent-desk#v<kit version>`. An existing `package.json` SHALL keep its content and gain the devDependency; one whose `devDependencies` already lists `agent-desk` (`dependencies` is not checked) SHALL be left unchanged.

#### Scenario: Existing package.json
- **WHEN** `package.json` exists without `agent-desk`
- **THEN** its other fields stay and `devDependencies.agent-desk` is added

### Requirement: Install step
Unless `--no-install` is given, `desk init` SHALL run `npm install` in the desk folder. A failed install SHALL print a `warn` line and not fail the command. The command SHALL end by printing the desk path and the next step (`desk sync`).

#### Scenario: Install fails
- **WHEN** `npm install` exits non-zero
- **THEN** a `warn npm install failed` line is printed and init still finishes
