## MODIFIED Requirements

### Requirement: Decide walk
The Decide command SHALL read `desk decide --json`, as `hooks/pane.tsx` does: the id is the one just read, never the row's, so a ruling lands on the question the owner read. It SHALL offer the options in a quick pick, each row's label the option's label, its detail the option's why, the first marked recommended in its description, and `Other…` last for a free-text ruling in an input box; a decision with no options goes straight to the input box. It SHALL record the answer with `desk decide <id> <ruling>` without a shell, then read the next decision. A choice SHALL record the label only. One walk SHALL run at a time.

#### Scenario: Pick and record
- **WHEN** T-5 has options `Keep: it works` and `Drop: less code`, and the owner picks `Drop`
- **THEN** the row showed `less code` as its detail, `desk decide T-5 "Drop"` runs, the record's `from` is `owner`, and the view refreshes

#### Scenario: Typed ruling
- **WHEN** the owner picks `Other…` and types `neither, wait`
- **THEN** `desk decide T-5 "neither, wait"` runs

#### Scenario: Walks on
- **WHEN** the owner rules T-5, T-6 waits and the owner rules it too, and none waits then
- **THEN** T-6 was asked and the walk ends with the message `No owner decisions waiting.`

#### Scenario: Closing the picker
- **WHEN** the owner closes the quick pick or the input box
- **THEN** nothing is recorded, the walk ends, and a message says nothing was recorded
