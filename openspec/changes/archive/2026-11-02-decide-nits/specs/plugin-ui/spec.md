## MODIFIED Requirements

### Requirement: Decide walk with options
A printed decision with 2 to 4 options SHALL be asked in the engine's question dialog, its text holding the
printed question and recommendation and its choices the options. The chosen label, or the text typed under
Other, SHALL be recorded, after redaction, as `desk decide <printed id> <ruling>` (on one line, cut to 1000 characters),
the pane SHALL refresh, and the walk SHALL go on with the decision that record printed.

#### Scenario: Press asks and records
- **WHEN** T-5 is printed with `Recommended: (a) keep` and `Or: (b) drop`, and the owner chooses `(b) drop`
- **THEN** the dialog's text holds the question and `Recommended: (a) keep`, its choices are `(a) keep` and `(b) drop`, and `desk decide T-5 "(b) drop"` runs and the pane refreshes

#### Scenario: Press records typed text
- **WHEN** the owner types `neither, wait for v0.4` under Other for T-5
- **THEN** `desk decide T-5 "neither, wait for v0.4"` runs

#### Scenario: A secret in the answer is not recorded
- **WHEN** the text typed under Other holds a secret
- **THEN** `desk decide` receives the text with the secret replaced by a `[REDACTED-...]` tag

#### Scenario: Press walks on
- **WHEN** recording T-5 prints T-6 as the next decision, with two options
- **THEN** the dialog asks T-6, and once it is recorded and `No owner decisions waiting.` prints, the walk ends with that in a toast
