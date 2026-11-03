## ADDED Requirements

### Requirement: Tasks and floor keys
`desk.config.json` MAY hold `tasks` and `floor`, each mapping a task id to optional `model` and `effort`. `loadConfig` SHALL throw `${file}: ...` for a value outside the accepted model names and efforts, and for `fable` in `floor`. It SHALL NOT check task ids, which the resolver warns about.

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

#### Scenario: Schema
- **WHEN** `desk check` validates a config with these keys
- **THEN** valid values pass `schemas/desk-config.schema.json` and a floor of `fable` prints a warning line
