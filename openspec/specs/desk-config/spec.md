# desk-config Specification

## Purpose

How the desk folder is found and how `desk.config.json` is loaded, validated and defaulted. Implemented
in `lib/config.mjs`.

## Requirements

### Requirement: Desk folder lookup
The system SHALL resolve the desk folder from `DESK_HOME` when it is set, and otherwise from the
nearest folder at or above the current directory that holds `desk.config.json`. Resolution SHALL be
lazy: importing the CLI, running `desk init` or a `--self-test` SHALL NOT need a desk.

#### Scenario: DESK_HOME wins
- **WHEN** `DESK_HOME` is set and the current directory is inside another desk
- **THEN** the folder named by `DESK_HOME` is the desk

#### Scenario: Walk up
- **WHEN** `DESK_HOME` is unset and the current directory is a subfolder of a desk
- **THEN** the nearest ancestor containing `desk.config.json` is the desk

#### Scenario: No desk
- **WHEN** neither `DESK_HOME` nor an ancestor `desk.config.json` exists and a command needs the desk
- **THEN** the command fails with a message naming `DESK_HOME` and `desk init`

### Requirement: Config parsing
The system SHALL read `desk.config.json` as JSON and SHALL fail with an error that names the file and
the parse error when it is not valid JSON. Relative paths in the file SHALL resolve against the desk
folder.

#### Scenario: Invalid JSON
- **WHEN** `desk.config.json` is not valid JSON
- **THEN** loading fails with `<file>: <parse error>`

### Requirement: Repo entries
Each entry of `repos` SHALL have an `id` made of lowercase letters, digits and dashes (starting with a
letter or digit) that is unique in the file, and a `path`. `kind` SHALL be `git` (default) or
`folder`. A `git` entry SHALL default `gh` to empty, `defaultBranch` to `main`, `branchPrefix` to
`agent/`, `worktreePrefix` to `<id>-`, and `install`, `build` and `check` to empty. Any listed key
SHALL override its default.

#### Scenario: Defaults
- **WHEN** a repo is listed with only `id` and `path`
- **THEN** it is a `git` repo on `main` whose branches start with `agent/` and whose worktree folders start with `<id>-`

#### Scenario: Bad id
- **WHEN** an id is missing, malformed or repeated
- **THEN** loading fails naming the entry index

#### Scenario: Missing path or unknown kind
- **WHEN** an entry has no `path`, or a `kind` other than `git` or `folder`
- **THEN** loading fails naming the entry

### Requirement: Distinct worktree prefixes
Among `git` repos, no `worktreePrefix` SHALL be a prefix of another's, so a worktree folder name
identifies exactly one repo.

#### Scenario: Overlapping prefixes
- **WHEN** repo `a` has prefix `app-` and repo `b` has prefix `app-api-`
- **THEN** loading fails naming both repos

### Requirement: Top-level keys and defaults
The system SHALL default `harnesses` to `["claude"]`, `permissions` to `{}` and `outputStyle` to `"Concise"`, SHALL refuse an `outputStyle` that is not a string (an empty string means "do not set one"), SHALL resolve
`worktreesDir` (default `../worktrees`) and `scratchDir` (default `scratch`) against the desk folder,
and SHALL keep every other top-level key of the file (such as `kitVersion`).

#### Scenario: Minimal config
- **WHEN** the file contains only `repos`
- **THEN** harnesses is `claude`, outputStyle is `Concise`, worktrees live in `../worktrees` and scratch output in `scratch`, both relative to the desk

#### Scenario: Bad output style
- **WHEN** `outputStyle` is a number
- **THEN** loading fails naming `outputStyle`

### Requirement: Repo selection
`--repo <id>` SHALL select a repo by id and fail naming the known ids when there is none such. Without
`--repo`, the only repo SHALL be selected; with several repos the command SHALL fail asking for
`--repo`, and with none it SHALL fail saying the config has no repos.

#### Scenario: Several repos, no flag
- **WHEN** a command needs a repo, the config lists two, and `--repo` is absent
- **THEN** it fails with `several repos: pass --repo <a|b>`

### Requirement: Base ref
Branches SHALL start from, and merge into, `origin/<defaultBranch>` when the repo has an `origin`
remote, and from the local `<defaultBranch>` in a clone without one.

#### Scenario: Local-only repo
- **WHEN** a repo has no `origin` remote
- **THEN** its base ref is the local default branch

### Requirement: Worktree discovery
The system SHALL list a desk's worktrees as the folders of `worktreesDir` whose name starts with a git
repo's `worktreePrefix` and that contain `.git`; the slug is the rest of the name.

#### Scenario: Leftover folder
- **WHEN** a worktree folder has no `.git` (removal left an empty folder)
- **THEN** it is not listed

### Requirement: Transcript projects
The system SHALL map a working directory to Claude Code's project folder name by replacing every
character outside `[a-zA-Z0-9]` with `-`, and SHALL count a project as the desk's when its name equals
or extends (after `-`) the name of the desk folder, `worktreesDir` or a repo path, ignoring case.

#### Scenario: Windows path
- **WHEN** a desk lives at `C:\x\desk`
- **THEN** its transcript folder name is `C--x-desk`

### Requirement: Kit lookup
The kit used for sync SHALL be the desk's pinned copy in `<desk>/node_modules/agent-desk` when it
exists, otherwise the running kit.

#### Scenario: Pinned kit
- **WHEN** `<desk>/node_modules/agent-desk/package.json` exists
- **THEN** skills, agents and the version come from that folder
