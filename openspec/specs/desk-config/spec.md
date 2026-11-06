# desk-config Specification

## Purpose

How the desk folder is found and how `desk.config.json` is loaded, validated and defaulted. Implemented
in `lib/config.mjs`.

## Requirements

### Requirement: Desk folder lookup
The system SHALL resolve the desk folder from `DESK_HOME` when it is set, and otherwise from the
nearest folder at or above the current directory that holds `desk.config.json`. Resolution SHALL be
lazy: importing the CLI or running `desk init` SHALL NOT need a desk.

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
The system SHALL default `harnesses` to `["claude"]`, `permissions` to `{}` and `outputStyle` to `"Concise"`, SHALL refuse a `harnesses` that is not a non-empty array of `claude` and `copilot`, SHALL refuse an `outputStyle` that is not a string (an empty string means "do not set one"), SHALL resolve
`worktreesDir` (default `../worktrees`) and `scratchDir` (default `scratch`) against the desk folder,
and SHALL keep every other top-level key of the file (such as `kitVersion`).

#### Scenario: Minimal config
- **WHEN** the file contains only `repos`
- **THEN** harnesses is `claude`, outputStyle is `Concise`, worktrees live in `../worktrees` and scratch output in `scratch`, both relative to the desk

#### Scenario: Bad output style
- **WHEN** `outputStyle` is a number
- **THEN** loading fails naming `outputStyle`

#### Scenario: Unknown harness
- **WHEN** `harnesses` is `["claud"]`
- **THEN** loading fails naming `harnesses`

#### Scenario: Empty harnesses
- **WHEN** `harnesses` is `[]`
- **THEN** loading fails naming `harnesses`

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

### Requirement: Tasks and floor keys
`desk.config.json` MAY hold `tasks` and `floor`, each mapping a task id to optional `model` and `effort`. `loadConfig` SHALL throw `${file}: ...` for a value outside the accepted model names and efforts, for `fable` in `floor`, for a `floor` that is not an object, and for a `floor` entry that is not an object or has a key other than `model` and `effort`. It SHALL NOT check task ids, which the resolver warns about.

#### Scenario: Valid keys
- **WHEN** the config sets `floor.review` to `opus` and `high`
- **THEN** the config loads and the keys are passed through

#### Scenario: Full model id refused
- **WHEN** `tasks.review.model` is `claude-opus-4-5`
- **THEN** `loadConfig` throws with the file and the key

#### Scenario: Fable as a floor refused
- **WHEN** `floor.review.model` is `fable`
- **THEN** `loadConfig` throws, because not every account has it and it can bill to usage credits

#### Scenario: Fable as a desk value
- **WHEN** `tasks.memo.model` is `fable`
- **THEN** the config loads

#### Scenario: Malformed floor entry
- **WHEN** `floor.review` is a string, or has a key such as `modle`
- **THEN** loading fails naming `floor.review`

#### Scenario: Floor of the wrong type
- **WHEN** `floor` is `true` or a number
- **THEN** loading fails naming `floor`

#### Scenario: Schema
- **WHEN** `desk check` validates a config with these keys
- **THEN** valid values pass `schemas/desk-config.schema.json` and a floor of `fable` prints a warning line

### Requirement: Unknown keys refused
`loadConfig` SHALL throw `${file}: ...` naming the key and where it sits for a key that `schemas/desk-config.schema.json` does not list at the top level (`$schema` is listed) or in a `repos` entry, and for a key other than `model` and `effort` in a `tasks` entry. It SHALL also throw for a `tasks` that is not an object, a `tasks` or `repos` entry that is not an object, and a file whose top level is not an object. The allowed keys SHALL be read from that schema, not listed a second time. The CLI SHALL refuse; the hooks (`scripts/merge-guard.mjs`, `scripts/subagent-context.mjs`) SHALL load with `{ strict: false }`, which ignores unknown keys and still throws for every type or value error, so an older plugin copy cannot fail open on a key only a newer kit knows.

#### Scenario: Typo in a repo
- **WHEN** a repo entry has `chek`
- **THEN** loading fails with `unknown key "chek" in repos[0]`

#### Scenario: Typo in a tasks entry
- **WHEN** `tasks.review.modle` is set
- **THEN** loading fails naming `modle` and `tasks.review`

#### Scenario: Hook ignores an unknown key
- **WHEN** a hook loads a config holding an unknown key
- **THEN** it loads and the merge guard still refuses a protected-branch push

#### Scenario: Tasks entry of the wrong type
- **WHEN** `tasks.review` is `"opus"`
- **THEN** loading fails naming `tasks.review`

### Requirement: Merge policy key
A `git` repo entry MAY set `merge` to `direct` or `review`. It SHALL default to `direct`. The value SHALL be read only from the committed `desk.config.json`: no user-layer file or environment variable SHALL set or override it.

#### Scenario: Default
- **WHEN** a repo entry has no `merge`
- **THEN** its `merge` is `direct` and every command behaves as it did before the key existed

#### Scenario: Bad value
- **WHEN** `merge` is any other value
- **THEN** loading the config fails naming the repo and the two values

#### Scenario: Review on a folder
- **WHEN** an entry with `kind: "folder"` sets `merge: "review"`
- **THEN** loading the config fails

#### Scenario: Review with no prefix
- **WHEN** an entry sets `merge: "review"` with an empty `branchPrefix`
- **THEN** loading the config fails, because nothing would be protected

#### Scenario: Review with the default branch inside the prefix
- **WHEN** an entry sets `merge: "review"` and its `defaultBranch` starts with its `branchPrefix`
- **THEN** loading the config fails, because the default branch would count as an agent branch

#### Scenario: No gh or origin does not fail the load
- **WHEN** an entry sets `merge: "review"` and has no `gh` value or no `origin`
- **THEN** the config loads, and `wt merge` and `desk check` report it

#### Scenario: User file cannot switch the policy
- **WHEN** a user-layer settings file holds `merge` or `repos`
- **THEN** the repo's `merge` stays what `desk.config.json` says
