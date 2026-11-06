## MODIFIED Requirements

### Requirement: Status commands
`todo start T-n [--slug s]` SHALL set status `active` and the owner to this session; when another session owned it, it SHALL print the previous owner on stderr. `todo done`, `drop`, `block` and `open` SHALL set status `done`, `dropped`, `blocked` and `open`, adding `--why` or `--note` as a note. `todo set T-n --field value ...` SHALL set any fields except `id`, `created` and `notes` (`todo` commands refuse those) and `todo note T-n <text...>` SHALL add a note from all the words given. `todo add <title...>` SHALL join all the words as the title. A `set` with no field and an empty note SHALL exit 1 and write nothing. Text over its cap SHALL be cut with a warning on stderr naming the field and its cap.
Each SHALL print the todo's line and write no other file. An unknown id SHALL exit 1 with `no todo <id>`.

#### Scenario: Drop with reason
- **WHEN** `todo drop T-2 --why "superseded"` runs
- **THEN** `T-2` has status `dropped` and a note `superseded`

#### Scenario: Several words
- **WHEN** `todo add one two three` and `todo note T-1 a b c` run
- **THEN** the title is `one two three` and the note is `a b c`

#### Scenario: Refused input
- **WHEN** `todo note T-1 ""`, `todo set T-1 words`, `todo set T-1 --note ""` or `todo add "  "` runs
- **THEN** it exits 1 with a message and writes nothing

#### Scenario: No generated view
- **WHEN** any todo command runs
- **THEN** no `TODO.md` is written

### Requirement: todo add
`todo add <title words>` SHALL join all the words as the title (an empty title exits 1) and append a todo with status `open`, size `small` and the given flags (`--area`, `--size`, `--prio`, `--why`, `--parent`, `--change`, `--tasks`, `--model`, or any other `--field value` except `--id`, `--created` and `--notes`). `--prio` SHALL be an integer. A bare `--` SHALL end flag parsing, so a title may start with `--`.

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
- **THEN** the command exits 1 with `add needs --area <repo id>|desk|owner|watch|idea`
