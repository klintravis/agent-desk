## MODIFIED Requirements

### Requirement: Append-only JSONL files
The desk's JSONL files (`todo.jsonl`, `board.jsonl`, `decisions.jsonl`) SHALL be written only by
appending one JSON line, retrying a failed append once, and every line written SHALL carry `v: 1`.
They SHALL be read by skipping any line that does not parse or is not a JSON object (`null`, a number), so a torn or hand-edited line never breaks
a reader, and a line without `v` SHALL be read like one with `v: 1`. A todo line whose `id` is not a string SHALL be skipped, and a note line without `ts` SHALL still fold.

#### Scenario: Torn line
- **WHEN** a line of `todo.jsonl` is not valid JSON
- **THEN** every other line is still read

#### Scenario: Null line
- **WHEN** a line of `board.jsonl` is `null`
- **THEN** every `desk board` command still works

#### Scenario: Hand-edited todo lines
- **WHEN** a todo note has no `ts`, or a line has a numeric `id`
- **THEN** `desk todo list` and `desk todo add` still exit 0

#### Scenario: Version on write
- **WHEN** any command appends a line to one of the files
- **THEN** the line has `"v":1`

#### Scenario: Old lines
- **WHEN** a line written before this change has no `v`
- **THEN** it is read and folded as before

### Requirement: Board kinds and posting
`board post <kind> <slug> [text] [--repo id]` SHALL append `{ts, from, kind, slug, text, repo?}` where
kind is one of `claim`, `release`, `ci`, `merged`, `verdict`, `note`, the slug matches
`[a-z0-9][a-z0-9-]*`, and text is cut to 120 characters. `--repo <id>` SHALL be accepted anywhere after `board`, including before the kind. It SHALL always exit 0: a bad kind or slug
prints `board: bad post ...` and an append failure prints its error, and neither fails the caller.

#### Scenario: Bad kind
- **WHEN** `board post wibble x` runs
- **THEN** nothing is appended and the exit code is 0

#### Scenario: Repo first
- **WHEN** `board post --repo a claim foo` runs
- **THEN** a `claim` of `foo` with `repo` `a` is appended
