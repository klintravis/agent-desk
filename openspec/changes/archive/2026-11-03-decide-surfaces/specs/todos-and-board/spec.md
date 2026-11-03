## MODIFIED Requirements

### Requirement: Decision options on a todo
A todo MAY carry `options: [{label, why}]`, the first being the recommended one; `why` of the todo is then the free-text
context of the question. `--option "<label>: <why>"` SHALL be repeatable and collect, split at the first `: `, on every
subcommand that takes flags. Every other flag SHALL keep overwriting on a repeat. Fewer than 2 or more than 4 options, an
empty label, a label over 60 characters, two options with the same label, or a literal `--options` flag SHALL fail with exit 1 and a clear error, and write
nothing.

#### Scenario: Options collected
- **WHEN** `todo add q --area owner --option "Refuse: safe: at a cost; rarely" --option "Allow"` runs
- **THEN** `options` is `[{label: "Refuse", why: "safe: at a cost; rarely"}, {label: "Allow"}]`

#### Scenario: Another flag repeated
- **WHEN** `--why first --why second` is given
- **THEN** `why` is `second`

#### Scenario: Out of limits
- **WHEN** one option, five options, or a label of 61 characters is given
- **THEN** the command fails with exit 1, an error naming `--option`, and writes nothing

#### Scenario: A value that reads like a flag
- **WHEN** a flag's value starts with `--`, also after leading spaces or control characters
- **THEN** the command fails with exit 1, an error naming that flag, and writes nothing
