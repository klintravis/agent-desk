## MODIFIED Requirements

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
- **WHEN** a repo tracks `.claude/settings.local.json` and the desk has the `claude` harness and the user file has cache keys
- **THEN** no user value is written to that file and a warning names it
- **AND** the rest of the sync proceeds

#### Scenario: Tracked settings file without the claude harness
- **WHEN** a repo tracks `.claude/settings.local.json` and the desk's harnesses are `copilot` only
- **THEN** no warning is printed: the cache keys are Claude Code's and are written nowhere

#### Scenario: Tracked key outlives the user's name
- **WHEN** a repo's tracked `.claude/settings.local.json` holds a key, the record lists that name from the user file, and the key is removed from the user file or its `cache` is emptied
- **THEN** the next full `desk sync` leaves the key in that file and `git status --porcelain` empty there
- **AND** the key leaves a checkout's ignored file

#### Scenario: Malformed user file
- **WHEN** the user file does not parse and `desk sync` runs
- **THEN** it warns, writes the carried keys as usual and exits as it would without the file

