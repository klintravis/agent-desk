## ADDED Requirements

### Requirement: Todo bookkeeping fields cannot be set by flag
`todo` commands SHALL refuse `--id`, `--created` and `--notes`, exit 1 and write nothing. Reading a `todo.jsonl` whose line holds a `notes` value that is not an array SHALL NOT fail; the value is kept as one note, after the notes already there. An old line whose `set` holds an `id` SHALL NOT change which todo the line belongs to.

#### Scenario: Notes flag
- **WHEN** `todo set T-1 --notes x` runs
- **THEN** it exits 1 and `todo.jsonl` is unchanged

#### Scenario: Existing string notes
- **WHEN** `todo.jsonl` already holds a line with `"notes": "old"` and `todo note T-1 new` runs
- **THEN** `todo list` exits 0 and `todo show T-1` lists the notes `old` and `new`

#### Scenario: Old id line
- **WHEN** `todo.jsonl` holds a line for T-1 with `"set": {"id": "Z"}`
- **THEN** later writes still go to T-1
