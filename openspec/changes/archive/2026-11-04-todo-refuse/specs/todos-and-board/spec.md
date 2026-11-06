## MODIFIED Requirements

### Requirement: Status commands
`todo start T-n [--slug s]` SHALL set status `active` and the owner to this session; when another session owned it, it SHALL print the previous owner on stderr. `todo done`, `drop`, `block` and `open` SHALL set status `done`, `dropped`, `blocked` and `open`, adding `--why` or `--note` as a note. `todo set T-n --field value ...` SHALL set any field of the todo schema except `id`, `created` and `notes` (`todo` commands refuse those) and `todo note T-n <text...>` SHALL add a note from all the words given. `todo add <title...>` SHALL join all the words as the title. A `set` with no field and an empty note SHALL exit 1 and write nothing. `todo done`, `drop`, `block` and `open` SHALL refuse any flag other than `--why` and `--note` and any word after the todo id, and `todo note` SHALL refuse any flag, and `todo add`, `set`, `start` and `split` SHALL refuse any flag that is not a field of the todo schema (and `set` and `start` any word after the todo id), each with exit 1, a message naming what was refused, and nothing written. Text over its cap SHALL be cut with a warning on stderr naming the field and its cap.
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

#### Scenario: Unknown flag or extra word
- **WHEN** `todo done T-1 --reason x`, `todo done T-1 T-2` (likewise `drop`, `block`, `open`) or `todo note T-1 --reason x` runs
- **THEN** it exits 1 naming `--reason` or `"T-2"`, `T-1` keeps its status and notes, and nothing is written

#### Scenario: Unknown field flag
- **WHEN** `todo set T-1 --sumary x`, `todo add t --reason x`, `todo start T-1 --foo x`, `todo split T-1 c --foo x` or `todo start T-1 T-2` runs
- **THEN** it exits 1 naming `--sumary`, `--reason`, `--foo` or `"T-2"`, and no field is stored

#### Scenario: No generated view
- **WHEN** any todo command runs
- **THEN** no `TODO.md` is written
