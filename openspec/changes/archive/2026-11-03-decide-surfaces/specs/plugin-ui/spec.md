## MODIFIED Requirements

### Requirement: /desk and /decide
The plugin SHALL register `/desk`, which opens the pane and answers `Desk pane opened.`, and `/decide
[T-n <ruling> | T-n --pick <n> | --list [n]]`. With arguments it runs `desk decide` with them (a ruling is one argument; text after the id that starts with the flag `--pick` is split on whitespace, so the CLI reads the flag and refuses a bad value) and returns its
output. Without, where `$.session.surfaces()` lists a surface and `desk decide --json` gives a decision with 2 to 4 options, it SHALL start the Decide walk below, as the Button does, and answer
at once, without waiting for the owner, `Decisions: answer in the dialog. If none opens, use /decide T-n <ruling> or desk decide.`, since a rule denying the dialog looks like a dismissal; the owner closing the dialog SHALL record nothing and toast nothing. Otherwise (none waiting, fewer than 2 or more than 4 options, output that is not JSON, no surface listed as in a `-p` run,
or the call fails) it SHALL return the printed `desk decide` text and open no dialog. `$.ui.ask` rejects alike on dismissal and with no one to ask, so the surfaces
list, not the rejection, tells them apart. After a recorded ruling the pane SHALL refresh at once.

#### Scenario: Record a ruling
- **WHEN** the user runs `/decide T-5 use option b`
- **THEN** `desk decide T-5 "use option b"` runs and the pane refreshes

#### Scenario: A mistyped pick is refused
- **WHEN** the user runs `/decide T-5 --pick two`, `/decide T-5 --pick <2>`, `/decide T-5 --pick` or `/decide T-5 --pick 2 extra`
- **THEN** `desk decide` receives the flag and each word as separate arguments and refuses them, nothing is recorded and T-5 stays open

#### Scenario: Typed /decide opens the dialog
- **WHEN** the user runs `/decide` with no arguments, a surface draws, and T-5 waits with two options
- **THEN** the same dialog as the Button's opens, and the chosen label is recorded as `desk decide T-5 "<label>"`

#### Scenario: Typed /decide, dialog closed
- **WHEN** the owner closes that dialog
- **THEN** nothing is recorded and no toast shows

#### Scenario: Typed /decide, no surface
- **WHEN** `/decide` runs with no arguments and `$.session.surfaces()` is empty
- **THEN** it returns the printed `desk decide` text and opens no dialog

#### Scenario: Typed /decide, none waiting
- **WHEN** `/decide` runs with no arguments, a surface draws and no decision waits
- **THEN** it returns `No owner decisions waiting.` and opens no dialog

#### Scenario: Typed /decide, 1 or 5+ options
- **WHEN** `/decide` runs with no arguments, a surface draws and the next decision has 1 or 5 options
- **THEN** it returns the printed `desk decide` text, the options and their whys stay on screen, and no dialog opens or toast shows

### Requirement: Decide walk with options
A decision read from `desk decide --json` with 2 to 4 options SHALL be asked in the engine's question dialog through `$.ui.ask`, its text holding the
question, the context and each option's why, and its choices the option labels. `$.ui.ask` takes labels only and no
document covers a plugin calling `AskUserQuestion` with per-option descriptions, so the whys stay in the question text.
This is a parity gap: the VS Code extension shows each why on the option's own row. The chosen label as it is, or the text typed under
Other after redaction, SHALL be recorded as `desk decide <id> <ruling>`, the ruling one argument (on one line, cut to 1000 characters),
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

#### Scenario: A clicked label is recorded as it is
- **WHEN** the owner chooses a label that holds an email address, or reads `--pick 1`
- **THEN** `desk decide` receives the label unchanged as one argument, and the CLI still refuses a secret in it

#### Scenario: Press records typed text
- **WHEN** the owner types `neither, wait for v0.4` under Other for T-5
- **THEN** `desk decide T-5 "neither, wait for v0.4"` runs

#### Scenario: Press walks on
- **WHEN** T-5 is recorded and T-6 waits, with two options
- **THEN** the dialog asks T-6, and once it is recorded and none waits, the walk ends with `No owner decisions waiting.` in a toast
