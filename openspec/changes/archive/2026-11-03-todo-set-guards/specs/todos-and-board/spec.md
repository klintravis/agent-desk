## ADDED Requirements

### Requirement: Todo status and parent are checked on write
`todo add`, `set`, `start` and `split` SHALL refuse a `--status` that is not one of `open`, `active`, `blocked`, `done`, `dropped`. `todo add`, `set` and `start` SHALL refuse a `--parent` that is not an existing todo, or that is the todo itself or one of its descendants. A refusal SHALL exit 1 and write nothing. `todo split` SHALL give its children the split todo as parent, whatever `--parent` says. Lines already in `todo.jsonl` SHALL NOT be checked, so a dangling parent higher up the chain does not block a write.

#### Scenario: Unknown status
- **WHEN** `todo set T-1 --status finished` runs
- **THEN** it exits 1 and `todo.jsonl` is unchanged

#### Scenario: Parent cycle
- **WHEN** T-2 is a child of T-1 and `todo set T-1 --parent T-2` or `todo set T-1 --parent T-1` runs
- **THEN** it exits 1 and `todo.jsonl` is unchanged

#### Scenario: Missing parent
- **WHEN** `todo set T-1 --parent T-99` runs and T-99 does not exist
- **THEN** it exits 1 with `no todo T-99` and `todo.jsonl` is unchanged

#### Scenario: Dangling parent further up
- **WHEN** T-3 already has the missing parent T-99 in `todo.jsonl` and `todo set T-5 --parent T-3` runs
- **THEN** it succeeds

#### Scenario: Split ignores --parent
- **WHEN** `todo split T-1 x --parent T-99` runs
- **THEN** the new child has parent T-1
