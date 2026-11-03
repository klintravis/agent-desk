## MODIFIED Requirements

### Requirement: Decide and rulings
`desk decide` SHALL show the first waiting owner decision, `desk decide --json` SHALL print the same decision as JSON, `desk decide T-n <ruling>` SHALL append the ruling to `decisions.jsonl` and close the todo, and `desk decide --list [n]` SHALL print the recorded rulings. A ruling MAY be an option's label or free text. An option's rationale SHALL NOT become part of its label.

#### Scenario: Show
- **WHEN** `desk decide` runs
- **THEN** it picks the first todo with area `owner`, status open, active or blocked, in priority order, and prints `<id> (1 of <n>): <title>`, its context when it has stored options, the first option as `Recommended`, the rest as `Or`, each option's why on the line under it, and the answer command
- **AND** with none waiting it prints `No owner decisions waiting.`

#### Scenario: JSON
- **WHEN** `desk decide --json` runs
- **THEN** it prints `{id, title, context, options: [{label, why}]}` for that same decision, `context` being null when the todo has no stored options
- **AND** with none waiting it prints `null`

#### Scenario: Old todo with only a why
- **WHEN** a waiting todo has `why` and no `options`
- **THEN** the `why` is split on `;` into options after dropping a leading `Options:`, a trailing ` (recommended)` is stripped from each and the option that carried it moves first
- **AND** `Label: rationale` parts are read as label and why only when there is more than one part and every part has a distinct label of at most 60 characters, none of them `Recommended`, `other` or `or`; otherwise each part stays a whole label with no why

#### Scenario: T-151 as written
- **WHEN** the why is `Refuse (recommended): a hidden push cannot slip through, at the cost of rare false refusals, also for allowed pushes and from any directory; Allow as before: no false refusals, as the 2026-11-02 merge-policy design said, but an unparseable line can hide a push from this guard`
- **THEN** the labels are `Refuse` and `Allow as before`, and each rationale is that option's why

#### Scenario: Ruling recorded
- **WHEN** `decide T-1 "keep it"` runs for a waiting owner decision
- **THEN** a record with `todo` `T-1`, the todo's title and `text` `keep it` is appended to `decisions.jsonl`
- **AND** `T-1` is marked `done` with the note `ruled: keep it`, `Recorded T-1: keep it` and the next decision are printed, and no `NEXT.md` is read or written

#### Scenario: A ruling that reads like the flag
- **WHEN** `decide T-1 --json` runs for a waiting owner decision
- **THEN** the ruling `--json` is recorded on `T-1`

#### Scenario: Append fails
- **WHEN** the append to `decisions.jsonl` fails
- **THEN** the command fails and the todo stays open

#### Scenario: Not an owner decision
- **WHEN** the todo has another area, or the ruling is empty
- **THEN** the command exits 1 and nothing is written

#### Scenario: List
- **WHEN** `desk decide --list` runs
- **THEN** it prints `# Rulings recorded` and the last 20 records (or `n`), oldest first, one line each: `- <date|undated>[ (<todo>)]: [<title>: ]<text>`
- **AND** with none it prints `No rulings recorded.`

## ADDED Requirements

### Requirement: Options in the status JSON
Each entry of `decisions` in `desk status --json` SHALL hold `options`, read the same way as `desk decide --json`. `v` SHALL stay 2.

#### Scenario: A decision with options
- **WHEN** a waiting decision has two options
- **THEN** its entry is `{id, title, options: [{label, why}, {label, why}]}` and the object still has `v` 2
