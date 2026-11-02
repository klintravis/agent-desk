## MODIFIED Requirements

### Requirement: todo add
`todo add "<title>"` SHALL append a todo with status `open`, size `small` and the given flags (`--area`, `--size`, `--prio`, `--why`, `--parent`, `--change`, `--tasks`, `--model`, or any other `--field value`). `--prio` SHALL be an integer. A bare `--` SHALL end flag parsing, so a title may start with `--`.

#### Scenario: Limits
- **WHEN** a title, `--why` or another value is long
- **THEN** the title is cut to 160 characters, `--why` to 1000 and other values to 300

#### Scenario: Priority
- **WHEN** `--prio 3` is given
- **THEN** `prio` is stored as the number 3

#### Scenario: Invalid priority
- **WHEN** `--prio` is missing its value or is not an integer (`abc`, `1.5`)
- **THEN** the command fails with exit 1, an error naming `--prio`, and writes nothing

#### Scenario: Flag value missing or starting with dashes
- **WHEN** any other `--field value` flag has no value, or its value starts with `--` (`--all` is value-less and never takes one)
- **THEN** the command fails with exit 1, an error naming the flag, and writes nothing

#### Scenario: Title starting with dashes
- **WHEN** the command is `todo add -- "--foo bar"`
- **THEN** the title is stored as `--foo bar`

#### Scenario: Invalid input
- **WHEN** the title is missing or `--parent` does not exist
- **THEN** the command fails with exit 1

#### Scenario: Area defaulted
- **WHEN** the desk has one repo `app` and `desk todo add "x"` runs
- **THEN** the todo's area is `app`

#### Scenario: Several repos
- **WHEN** the desk has two repos and `--area` is absent
- **THEN** the command exits 1 with `add needs --area <repo id>|desk|owner`
