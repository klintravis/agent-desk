## MODIFIED Requirements

### Requirement: Desk pane footer
Under the tabs the pane SHALL show the status time. The pane SHALL NOT draw the status text, nor the notice that status text is data, which is for agents.

#### Scenario: Footer
- **WHEN** the pane is drawn after a status result
- **THEN** the status time appears under the tabs, and no `never approval` wording

### Requirement: Decisions band
A band above the prompt SHALL show only what needs acting on:
- in a desk, `⚑ <n> decision(s) waiting` with a `Decide (<n>)` Button, when n > 0, where n is the status
  JSON's `decisions` count;
- in any session, `ctx <bar 8> <pct>%  near full: handoff or /compact`, when context is 80% or more.

The band SHALL be hidden while a survey is shown, and when neither row applies.

#### Scenario: Two waiting
- **WHEN** two decisions wait, T-5 first, and context is under 80%
- **THEN** the band reads `⚑ 2 decisions waiting` with a `Decide (2)` Button and no ctx row

#### Scenario: Near full only
- **WHEN** nothing waits and context is at 84%
- **THEN** the band reads `ctx ▰▰▰▰▰▰▰▱ 84%  near full: handoff or /compact`

### Requirement: Decide button
A `Decide (<n>)` Button, n the number of waiting decisions, in the band or the pane's Decisions tab, SHALL be drawn as the primary action, and
the band's count SHALL be yellow. A press SHALL run `desk decide` from the plugin's own code, not through the
engine's command chain, and SHALL walk the waiting decisions as the requirements below say.

#### Scenario: Only the plugin answers
- **WHEN** the user presses `Decide (1)` in the band or the pane and no other hook answers `/decide`
- **THEN** `desk decide` runs

### Requirement: Decide walk without options
A decision with fewer than 2 or more than 4 options SHALL show its text and the answer command in a toast and, where
the surface's prompt box takes it, fill an empty prompt with `/decide <id> `. The walk SHALL end there.

#### Scenario: Press /decide
- **WHEN** the user presses `Decide (1)`, T-5 has no options, or more than 4, and the prompt is empty
- **THEN** a toast shows the decision, no dialog opens and the prompt holds `/decide T-5 `

#### Scenario: No choices to offer, draft
- **WHEN** T-5 has no options, or more than 4, and the prompt holds a draft
- **THEN** a toast shows the decision and the draft is unchanged

### Requirement: Decide with nothing printed
When `desk decide --json` gives no decision, nothing SHALL be asked or filled, and any output SHALL be shown in a toast. Output that is not JSON SHALL be treated as a failure, never parsed for a decision.

#### Scenario: Nothing printed
- **WHEN** the owner presses `Decide (1)` and `desk decide --json` prints no decision
- **THEN** no dialog opens and nothing is filled

#### Scenario: Not JSON
- **WHEN** `desk decide --json` prints text that is not JSON, even text that reads like a decision
- **THEN** no dialog opens, nothing is recorded and a toast shows an error

### Requirement: Decide id, draft and repeat presses
The id SHALL be the one `desk decide --json` returned, never the status's first. A draft SHALL NOT be overwritten. A press
during a walk SHALL do nothing.

#### Scenario: A newer id than the Button's
- **WHEN** the status lists T-5 first and `desk decide --json` returns T-60
- **THEN** the dialog asks T-60 and the ruling is recorded on T-60, not T-5

#### Scenario: Press with a draft
- **WHEN** the prompt holds a draft and the owner presses `Decide (1)` and chooses an option
- **THEN** the ruling is recorded and the draft is unchanged

#### Scenario: Second press
- **WHEN** the owner presses `Decide (1)` while its dialog is open
- **THEN** no second dialog opens

### Requirement: Desk pane Decisions tab
The Decisions tab SHALL show each waiting decision as `<id> <title>`, then its options from `decisions[].options`: `Recommended: <label>` for the first and `Or: <label>` for the others, each followed by ` · <why>` when it has one. A `Decide (<n>)` Button, n the number waiting, SHALL follow. With nothing waiting it SHALL read `No decisions waiting`, with no Button. While one waits, the tab Button SHALL show a yellow dot, so a closed tab hides no decision.

#### Scenario: A decision waits and the Work tab is open
- **WHEN** a decision waits and the Work tab is open
- **THEN** the tab reads `Decisions 1` with a yellow dot, and the decision and its Decide Button show once that tab is pressed

#### Scenario: Options and whys
- **WHEN** T-5 has options `keep` (why `it works`) and `drop` (no why)
- **THEN** the tab shows `T-5 <title>`, `Recommended: keep · it works`, `Or: drop` and `Decide (1)`

#### Scenario: A decision with no options
- **WHEN** a decision has none in the status
- **THEN** its id and title still show
