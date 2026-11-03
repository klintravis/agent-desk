## ADDED Requirements

### Requirement: User layer never committed
The user file SHALL have no effect on any file git tracks or could commit. `desk sync` and `desk wt new` SHALL write user values only as the `cache` keys in `.claude/settings.local.json`, and `.claude/synced-permissions.json` SHALL hold their names only. `syncCopilot` SHALL NOT read the user file.

#### Scenario: Nothing to commit after a sync
- **WHEN** a desk with the `claude` and `copilot` harnesses, its repo and a worktree are synced and committed, a user file with distinctive `tasks` and `cache` values is added, and `desk sync` runs again
- **THEN** `git status --porcelain` is empty in the desk, the repo and the worktree
- **AND** `.claude/settings.local.json` in each holds the `cache` values

#### Scenario: Copilot files identical
- **WHEN** `desk sync` runs with and without a user file
- **THEN** `.github/agents/*.agent.md` and `.github/skills/` are byte-identical
- **AND** the `model` and `reasoning-effort` of each agent file come from kit frontmatter

#### Scenario: Task values written nowhere
- **WHEN** a user file sets `tasks` and `desk sync` runs
- **THEN** no file written by the sync holds them

#### Scenario: Record holds names only
- **WHEN** a full sync writes user cache keys
- **THEN** `.claude/synced-permissions.json` lists the key names and none of the values

### Requirement: User cache keys in local settings
`desk sync` and `desk wt new` SHALL overlay the user file's `cache` keys on the keys written to `.claude/settings.local.json` of the desk folder, each checkout and each worktree, above the desk's carried keys. They SHALL do so only where `git check-ignore` reports the file ignored or the folder is not in a git work tree. A malformed user file SHALL write nothing from the user layer and SHALL NOT fail the sync.

#### Scenario: User beats the desk
- **WHEN** the desk's `.claude/settings.json` sets `promptCacheTtl` to `1h` and the user file sets `5m`
- **THEN** each `.claude/settings.local.json` holds `5m`
- **AND** the desk's `.claude/settings.json` is unchanged

#### Scenario: Other keys kept
- **WHEN** a `.claude/settings.local.json` holds a key the user added by hand
- **THEN** that key survives the overlay

#### Scenario: Value removed
- **WHEN** a key is removed from the user file and a full `desk sync` runs
- **THEN** a checkout's file holds the desk's carried value, or no key if the desk has none
- **AND** the desk folder's file holds no such key, so its `.claude/settings.json` applies again

#### Scenario: Partial sync
- **WHEN** `desk sync <path>` runs
- **THEN** the user's cache keys are written to that path and the record file is unchanged

#### Scenario: Tracked settings file
- **WHEN** a repo tracks `.claude/settings.local.json`
- **THEN** no user value is written to that file and a warning names it
- **AND** the rest of the sync proceeds

#### Scenario: Malformed user file
- **WHEN** the user file does not parse and `desk sync` runs
- **THEN** it warns, writes the carried keys as usual and exits as it would without the file
