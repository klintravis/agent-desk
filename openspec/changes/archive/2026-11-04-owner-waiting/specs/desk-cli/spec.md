## ADDED Requirements

### Requirement: A ruled owner todo is not waiting
A todo with area `owner` SHALL count as a waiting owner decision while its status is open or blocked, or while it is active and holds no `ruled:` note (the note `desk decide` writes when it closes one). A ruled one that is started for work (active) does not wait; reopened (open) or blocked it waits again, and a new ruling replaces the old one. `desk status` (its `decisions` and the owner count), `desk decide`, `desk decide --json`, the watch's `OWNER+:` lines, `desk decide T-n <ruling>` and the pane's Decisions count and Decide press SHALL all use that one set. A ruled owner todo that is active SHALL be listed with the work todos in `desk status`.

#### Scenario: Ruled, then started
- **WHEN** `T-1` (area `owner`) was ruled with `desk decide` and then `desk todo start T-1` ran
- **THEN** `T-1` is not in `decisions` of `desk status --json`, not shown by `desk decide` or `desk decide --json`, and `desk decide T-1 <ruling>` exits 1; it is listed among the status todos and in `active` (or, with a branch or claim on its slug, in Work)

#### Scenario: Ruled, started, reopened
- **WHEN** a ruled owner todo was started and is then set back to open or blocked
- **THEN** it is in `decisions` again, `desk decide T-n <ruling>` records the new ruling, and `desk decide --list` shows it

#### Scenario: Never ruled, started
- **WHEN** an owner todo with no `ruled:` note is started
- **THEN** it still counts as waiting, since the question has not been answered

## MODIFIED Requirements

### Requirement: Decide and rulings
`desk decide` SHALL show the first waiting owner decision, `desk decide --json` SHALL print the same decision as JSON, `desk decide T-n <ruling>` SHALL append the ruling to `decisions.jsonl` and close the todo, `desk decide T-n --pick <n>` SHALL do the same with the nth option's label, counted from 1 as `--json` lists them, and `desk decide --list [n]` SHALL print the recorded rulings. `--pick` SHALL be read only as an argument of its own, never from the text of a ruling. A ruling MAY be an option's label or free text. An option's rationale SHALL NOT become part of its label. An option with an empty label SHALL NOT be listed or counted. A ruling shaped like a secret SHALL be refused, since `decisions.jsonl` is committed.

#### Scenario: Show
- **WHEN** `desk decide` runs
- **THEN** it picks the first todo with area `owner`, status open or blocked, or active with no `ruled:` note, in priority order, and prints `<id> (1 of <n>): <title>`, its context when it has stored options, the options numbered from 1, the first as `Recommended`, the rest as `Or`, each option's why on the line under it, and the answer command, which gives `desk decide <id> --pick <n>` and free words in single quotes, never in double quotes
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
- **AND** `--pick 3` given as one argument, as the dialog and VS Code send a clicked label, is recorded as `--pick 3`, whatever option 3 holds

#### Scenario: Pick an option
- **WHEN** `decide T-1 --pick 2` runs, as two arguments, and the second option's label holds quotes and a shell command
- **THEN** that label is recorded whole, as if given as the ruling, and `T-1` is closed
- **AND** the mod's typed `/decide T-1 --pick 2` sends the flag and the number as separate arguments and does the same; typed text not starting with the flag stays one argument

#### Scenario: A pick written with =
- **WHEN** the first ruling argument starts with `--pick=`, as `decide T-1 --pick=2` or the typed `/decide T-1 --pick=2`
- **THEN** the command exits 1 saying to pick the option in the list or write the flag with a space, echoing none of the text, nothing is recorded and the todo stays open, since a shell and a clicked label send the same single argument

#### Scenario: An empty label
- **WHEN** an old todo's why is `(recommended); b`
- **THEN** `--json` lists only `b`, and `decide T-1 --pick 1` records `b`

#### Scenario: A bad pick
- **WHEN** `--pick` has no value, also as a lone argument exactly `--pick`, a value that is not a whole number or one out of range, the todo has no options, or the picked label is empty once cleaned
- **THEN** the command exits 1 with a message naming the problem, nothing is recorded and the todo stays open

#### Scenario: A ruling shaped like a secret
- **WHEN** the ruling, given as text or through `--pick`, holds a vendor key, a private key or a password in a connection string, even past the 1000-character cut
- **THEN** the command exits 1 with a message that does not repeat it, nothing is recorded and the todo stays open
- **AND** a bare `sk-` run (not `sk-ant-`) with no digit in its first 101 characters, as in `risk-based-rollout-for-every-branch`, is no vendor key and is recorded; one of 20 or more characters with a digit in its first 101 is refused, also after a literal `\n`, after `%3D` or glued to a word; `sk-ant-` plus 16 or more characters is refused with or without a digit, whatever precedes it; a look-alike the CLI refuses is masked, not refused, when it arrives as the dialog's Other text

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

### Requirement: Todos in the status JSON
`desk status --json` SHALL hold `todos`: every todo with status open, active or blocked, except a waiting owner decision (area `owner`, open or blocked, or active with no `ruled:` note; a ruled one that is active is listed), except area `idea` unless it is active, and except an active todo whose slug has an open branch or an open claim (that todo is in Work), ordered active first, then by priority, then id (a surface that shows only the first few never hides an active todo). `v` SHALL stay 2 and the printed screen SHALL not change.

#### Scenario: What is not started
- **WHEN** todos are open, blocked or in area `watch`
- **THEN** each is in `todos`

#### Scenario: Decisions and ideas
- **WHEN** a todo is a waiting owner decision, or has area `idea` and is not active
- **THEN** it is not in `todos`

#### Scenario: An active idea
- **WHEN** a todo in area `idea` is active and its slug has no open branch or claim
- **THEN** it is in `todos`

#### Scenario: A todo in Work
- **WHEN** an active todo's slug has an open branch or claim
- **THEN** it is in `active` and not in `todos`

#### Scenario: Active with nowhere to show
- **WHEN** an active todo has no slug, or its slug has no open branch or claim
- **THEN** it is in `active` and in `todos`, so it is shown once

#### Scenario: Nothing open
- **WHEN** no todo qualifies
- **THEN** `todos` is an empty list and the object still has `v` 2
