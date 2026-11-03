## MODIFIED Requirements

### Requirement: Dispatch
`desk <command>` SHALL run one of `status`, `check`, `board`, `todo`, `tokens`, `overlap`, `decide`, `wt`, `stream`, `init`, `sync`, `workspace`, `settings`, or `home` (specified below).

#### Scenario: Version
- **WHEN** `desk --version` runs
- **THEN** the kit version is printed

#### Scenario: Self-test
- **WHEN** `desk --self-test` runs
- **THEN** the built-in self-tests of board, todo, tokens, status, watch and decide run
- **AND** it prints `ok` and exits 0, or prints `FAIL` and the failed checks and exits 1

#### Scenario: Unknown command
- **WHEN** `desk frobnicate` runs
- **THEN** a usage line listing the commands is printed and the exit code is 1

#### Scenario: Error reporting
- **WHEN** a command throws `no repo "x"`
- **THEN** stderr shows `desk <command>: no repo "x"` and the exit code is 1

#### Scenario: On-demand commands
- **WHEN** `wt`, `stream`, `init`, `sync` or `workspace` has a fault
- **THEN** it loads on demand, so `status` still works

### Requirement: Status JSON
`desk status --json` SHALL print one JSON object and a newline, built from the same gathered data as the
text screen and valid against `schemas/desk-status.schema.json`. Without `--json`, `desk status` SHALL
print the text screen unchanged. `--watch` SHALL take priority over `--json`.

#### Scenario: Fields
- **WHEN** `desk status --json` runs
- **THEN** the object has `v` (1), `at`, `decisions`, `active`, `claims`, `sessions`, `roots`, `branches`, `prs`, `overlaps`, `tokens`, `user` and `text`
- **AND** `sessions`, `prs`, `overlaps` and `tokens` are null when their source is unavailable or no lookup ran
- **AND** `user` is null when no user layer is active

#### Scenario: Parses and validates
- **WHEN** `desk status --json` runs in a desk
- **THEN** stdout parses as one JSON object that validates against the `desk-status` schema, and the command exits 0

#### Scenario: Same data as the text
- **WHEN** `desk status` and `desk status --json` run on the same desk state
- **THEN** the JSON `text` equals the text screen, apart from the time on the heading line
- **AND** the waiting decisions and claims in the JSON are the ones the text lists

#### Scenario: Sources down
- **WHEN** `gh` and the transcripts cannot be read
- **THEN** `sessions` is null, each branch's `ci` is `CI unavailable`, and the command exits 0

#### Scenario: Verdict kept whole
- **WHEN** a branch's newest verdict carries `by <model>/<effort>`
- **THEN** its `verdict` holds the whole text, up to the 120 characters the board stores

## ADDED Requirements

### Requirement: Settings command
`desk settings [--json]` SHALL print, for each task id, the resolved `model` and `effort` with the source layer of each, and for each cache key its value and source. It SHALL write nothing. With `--json` it SHALL print one JSON object holding `userFile`, `active`, `tasks`, `cache` and `warnings`, and each task SHALL hold `agent`, `task`, `model`, `effort`, `source` and `shared`. Without `--json`, warnings SHALL go to stderr as `warn <text>`.

#### Scenario: Values and sources
- **WHEN** `desk settings --json` runs with a user file setting `review.effort` to `medium`
- **THEN** `tasks.review.effort` is `medium`, `tasks.review.source.effort` is `user`, and `tasks.review.source.model` is `kit`

#### Scenario: Bad user file
- **WHEN** the user file does not parse
- **THEN** the command prints the desk's values with a warning and exits 0

#### Scenario: No desk
- **WHEN** it runs outside a desk
- **THEN** it reports the usual no-desk error and exits 1, so the skill falls back to its table

#### Scenario: Cache sources
- **WHEN** the desk's `.claude/settings.json` sets `promptCacheTtl` and the user file sets `subagentPromptCacheTtl`
- **THEN** their sources are `desk` and `user`, and a key neither sets has source `unset`

#### Scenario: Env shadows a cache key
- **WHEN** `CLAUDE_CODE_PROMPT_CACHE_TTL` or `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` is set
- **THEN** it warns that the variable takes precedence over the key

#### Scenario: Not applied yet
- **WHEN** the user's cache value differs from the desk's `.claude/settings.local.json`
- **THEN** it warns to run `desk sync`

#### Scenario: Copilot harness
- **WHEN** the `copilot` harness is configured
- **THEN** it states that model and effort are advisory on Copilot

### Requirement: User layer on the status screen
When a user layer is active, `desk status` SHALL print one line directly under its heading, naming the user file, the tasks whose resolved model or effort is below `shared`, and values a floor raised. When none is active the screen SHALL be unchanged. A problem reading the user file SHALL NOT fail the command.

#### Scenario: Cheaper review
- **WHEN** the user file lowers `review` to `sonnet` and `medium` with no floor
- **THEN** the line names `review`, `sonnet/medium` and the shared `opus/high`
- **AND** the JSON `user` holds the same entry

#### Scenario: No user layer
- **WHEN** no user file exists
- **THEN** no such line prints and `user` is null

#### Scenario: Only invalid values
- **WHEN** the user file holds no accepted value
- **THEN** no such line prints and `user` is null

### Requirement: User layer in check
Inside a desk, `desk check` SHALL print a `warn` line when a user layer is active, and one for each resolver warning. The exit code SHALL be unaffected.

#### Scenario: Active layer
- **WHEN** a user file sets a value and `desk check` runs
- **THEN** a `warn` line names the user file and the exit code is unchanged

#### Scenario: Malformed file
- **WHEN** the user file does not parse and `desk check` runs
- **THEN** a `warn` line says so and the exit code is unchanged
