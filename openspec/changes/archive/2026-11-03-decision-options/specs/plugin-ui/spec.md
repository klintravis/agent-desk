## MODIFIED Requirements

### Requirement: Decide walk with options
A decision read from `desk decide --json` with 2 to 4 options SHALL be asked in the engine's question dialog through `$.ui.ask`, its text holding the
question, the context and each option's why, and its choices the option labels. `$.ui.ask` takes labels only and no
document covers a plugin calling `AskUserQuestion` with per-option descriptions, so the whys stay in the question text.
This is a parity gap: the VS Code extension shows each why on the option's own row. The chosen label, or the text typed under
Other, SHALL be recorded, after redaction, as `desk decide <id> <ruling>` (on one line, cut to 1000 characters),
the pane SHALL refresh, and the walk SHALL go on with a fresh read of the next decision.

#### Scenario: Press asks and records
- **WHEN** T-5 has options `Keep: it works` and `Drop: less code`, and the owner chooses `Drop`
- **THEN** the dialog's text holds the question, `Recommended: Keep - it works` and `Or: Drop - less code`, its choices are `Keep` and `Drop`, and `desk decide T-5 "Drop"` runs and the pane refreshes

#### Scenario: The rationale is never the ruling
- **WHEN** an old todo has the T-151 why, and the owner chooses its first option
- **THEN** the dialog's choices are `Refuse` and `Allow as before`, and the ruling recorded is `Refuse`

#### Scenario: A secret in the answer is not recorded
- **WHEN** the text typed under Other holds a secret
- **THEN** `desk decide` receives the text with the secret replaced by a `[REDACTED-...]` tag

#### Scenario: Press records typed text
- **WHEN** the owner types `neither, wait for v0.4` under Other for T-5
- **THEN** `desk decide T-5 "neither, wait for v0.4"` runs

#### Scenario: Press walks on
- **WHEN** T-5 is recorded and T-6 waits, with two options
- **THEN** the dialog asks T-6, and once it is recorded and none waits, the walk ends with `No owner decisions waiting.` in a toast

### Requirement: Decide walk without options
A decision with fewer than 2 or more than 4 options SHALL show its text and the answer command in a toast and, where
the surface's prompt box takes it, fill an empty prompt with `/decide <id> `. The walk SHALL end there.

#### Scenario: Press /decide
- **WHEN** the user presses `Decide T-5`, T-5 has no options, or more than 4, and the prompt is empty
- **THEN** a toast shows the decision, no dialog opens and the prompt holds `/decide T-5 `

#### Scenario: No choices to offer, draft
- **WHEN** T-5 has no options, or more than 4, and the prompt holds a draft
- **THEN** a toast shows the decision and the draft is unchanged

### Requirement: Decide with nothing printed
When `desk decide --json` gives no decision, nothing SHALL be asked or filled, and any output SHALL be shown in a toast. Output that is not JSON SHALL be treated as a failure, never parsed for a decision.

#### Scenario: Nothing printed
- **WHEN** the owner presses `Decide T-5` and `desk decide --json` prints no decision
- **THEN** no dialog opens and nothing is filled

#### Scenario: Not JSON
- **WHEN** `desk decide --json` prints text that is not JSON, even text that reads like a decision
- **THEN** no dialog opens, nothing is recorded and a toast shows an error

### Requirement: Decide id, draft and repeat presses
The id SHALL be the one `desk decide --json` returned, never the Button's. A draft SHALL NOT be overwritten. A press
during a walk SHALL do nothing.

#### Scenario: A newer id than the Button's
- **WHEN** the Button reads `Decide T-5` and `desk decide --json` returns T-60
- **THEN** the dialog asks T-60 and the ruling is recorded on T-60, not T-5

#### Scenario: Press with a draft
- **WHEN** the prompt holds a draft and the owner presses `Decide T-5` and chooses an option
- **THEN** the ruling is recorded and the draft is unchanged

#### Scenario: Second press
- **WHEN** the owner presses `Decide T-5` while its dialog is open
- **THEN** no second dialog opens
