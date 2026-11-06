## MODIFIED Requirements

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
