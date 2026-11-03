## MODIFIED Requirements

### Requirement: Decisions band
A band above the prompt SHALL show only what needs acting on:
- in a desk, `⚑ <n> decision(s) waiting` with a `Decide <id>` Button, when n > 0, where n is the status
  JSON's `decisions` count and `<id>` its first decision;
- in any session, `ctx <bar 8> <pct>%  near full: handoff or /compact`, when context is 80% or more.

The band SHALL be hidden while a survey is shown, and when neither row applies.

A `Decide <id>` Button, in the band or the pane's Owner decisions card, SHALL be drawn as the primary action, and
the band's count SHALL be yellow. A press SHALL run `desk decide` from the plugin's own code, not through the
engine's command chain, and SHALL walk the waiting decisions:
- A printed decision with 2 to 4 options SHALL be asked in the engine's question dialog, its text holding the
  printed question and recommendation and its choices the options. The chosen label, or the text typed under
  Other, SHALL be recorded verbatim as `desk decide <printed id> <ruling>`, the pane SHALL refresh, and the walk
  SHALL go on with the decision that record printed.
- A printed decision with fewer than 2 or more than 4 options SHALL show the printed text in a toast and, where
  the surface's prompt box takes it, fill an empty prompt with `/decide <printed id> `. The walk SHALL end there.
- A declined or refused dialog SHALL record nothing and fill nothing, and SHALL end the walk with a toast of the
  reason. A record that fails SHALL end the walk with a toast of `desk decide`'s output.
- When no decision is printed, nothing SHALL be asked or filled, and any output SHALL be shown in a toast.

The id SHALL be the one `desk decide` printed, never the Button's. A draft SHALL NOT be overwritten. A press
during a walk SHALL do nothing.

#### Scenario: Two waiting
- **WHEN** two decisions wait, T-5 first, and context is under 80%
- **THEN** the band reads `⚑ 2 decisions waiting` with a `Decide T-5` Button and no ctx row

#### Scenario: Only the plugin answers
- **WHEN** the user presses `Decide T-5` in the band or the pane and no other hook answers `/decide`
- **THEN** `desk decide` runs

#### Scenario: Press asks and records
- **WHEN** T-5 is printed with `Recommended: (a) keep` and `Or: (b) drop`, and the owner chooses `(b) drop`
- **THEN** the dialog's text holds the question and `Recommended: (a) keep`, its choices are `(a) keep` and `(b) drop`, and `desk decide T-5 "(b) drop"` runs and the pane refreshes

#### Scenario: Press records typed text
- **WHEN** the owner types `neither, wait for v0.4` under Other for T-5
- **THEN** `desk decide T-5 "neither, wait for v0.4"` runs

#### Scenario: Press walks on
- **WHEN** recording T-5 prints T-6 as the next decision, with two options
- **THEN** the dialog asks T-6, and once it is recorded and `No owner decisions waiting.` prints, the walk ends with that in a toast

#### Scenario: Press with a draft
- **WHEN** the prompt holds a draft and the owner presses `Decide T-5` and chooses an option
- **THEN** the ruling is recorded and the draft is unchanged

#### Scenario: Declined
- **WHEN** the owner closes the dialog for T-5
- **THEN** nothing is recorded, nothing is filled, a toast gives the reason and no next question follows

#### Scenario: Ruled elsewhere
- **WHEN** another session rules T-5 while its dialog is open and the owner then chooses an option
- **THEN** `desk decide` refuses, its output is shown in a toast and the walk ends

#### Scenario: Press /decide
- **WHEN** the user presses `Decide T-5`, T-5 is printed with no options, or with more than 4, and the prompt is empty
- **THEN** a toast shows the printed text, no dialog opens and the prompt holds `/decide T-5 `

#### Scenario: No choices to offer, draft
- **WHEN** T-5 is printed with no options, or with more than 4, and the prompt holds a draft
- **THEN** a toast shows the printed text and the draft is unchanged

#### Scenario: Nothing printed
- **WHEN** the owner presses `Decide T-5` and `desk decide` prints no decision
- **THEN** no dialog opens and nothing is filled

#### Scenario: A newer id than the Button's
- **WHEN** the Button reads `Decide T-5` and `desk decide` prints T-60
- **THEN** the dialog asks T-60 and the ruling is recorded on T-60, not T-5

#### Scenario: Second press
- **WHEN** the owner presses `Decide T-5` while its dialog is open
- **THEN** no second dialog opens

#### Scenario: Near full only
- **WHEN** nothing waits and context is at 84%
- **THEN** the band reads `ctx ▰▰▰▰▰▰▰▱ 84%  near full: handoff or /compact`
