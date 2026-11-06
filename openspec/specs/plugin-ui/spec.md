# plugin-ui Specification

## Purpose

What the Claude plugin shows: the status line, the meters (plan quota, context, cache), the
Desk pane, the decisions band, the `/desk` and `/decide` commands and the toast. Implemented in
`hooks/meters.ts`, `hooks/quota.ts`, `hooks/pane.tsx` and `hooks/register.ts`. The plugin registers
one module, `hooks/register.ts`, through `hooks/hooks.json`.

## Requirements

### Requirement: One status line
The plugin SHALL draw one status line of its own, joined by ` · `, from these slots in order:
1. `ctx <bar 8> <pct>%`.
2. `<name> <bar 4> <pct>%` for the `5h` window, else the first window in quota order.
3. `warm auto` or `warm off`, in a desk only.
4. `⚑ <n>`, in a desk only and only when n decisions wait and n > 0.

The line SHALL be cleared when all slots are empty. It SHALL carry no cache meter, no near-full hint and
no warm-hold reason.

#### Scenario: Joined line
- **WHEN** in a desk, context is at 42%, the 5h window is at 31%, keep-warm is auto and 1 decision waits
- **THEN** the status line is `ctx ▰▰▰▱▱▱▱▱ 42% · 5h ▰▱▱▱ 31% · warm auto · ⚑ 1`

#### Scenario: Nothing waits
- **WHEN** no decision waits
- **THEN** the line has no `⚑` slot

#### Scenario: Outside a desk
- **WHEN** the session is not in a desk
- **THEN** the ctx and quota slots still show, with no warm or `⚑` slot and no pane
- **AND** the band shows only its near-full row

### Requirement: Meter refresh
The meters SHALL be read after every main-session turn and once a minute. Meters SHALL show outside a desk too.

#### Scenario: Read after a turn
- **WHEN** a main-session turn ends
- **THEN** the meters are read

### Requirement: Quota meter
The pane's Quota row SHALL list each plan window as `<name> <bar 10> <pct>%`. The first window SHALL be
followed by ` · resets <duration>` when its reset time is known. The row SHALL end with a forecast. It
SHALL be absent when there are no limits.

#### Scenario: Window order
- **WHEN** several windows exist
- **THEN** they are listed in the order `5h`, `7d`, `spend` (others after)

#### Scenario: Forecast text
- **WHEN** a window fills before its own reset
- **THEN** the row ends `<name> full in ~<duration>` for the one that fills first
- **AND** otherwise it ends `collecting burn rate` while no window has a burn rate, else `nothing hits 100% before reset`

#### Scenario: Forecast
- **WHEN** the 5h window rose 20 points over an hour, 42% is used and the reset is 4h away
- **THEN** the row ends `5h full in ~2h54m`

#### Scenario: Too early for a rate
- **WHEN** the samples span less than a twentieth of the window
- **THEN** no burn rate is computed for that window, and the row says `collecting burn rate` only if no other window has one

### Requirement: Quota samples
Readings SHALL be kept per window as `(time, percent, reset time)`, at most 240, only those inside the window, and thinned to the window divided by 240 (while the newest sample is closer than that to the one before it, a new reading replaces it), so 240 samples span the whole window. A changed reset time, or a percent that fell by more than 0.5, SHALL start a new window and drop the older samples.

#### Scenario: Further rules
Samples SHALL persist in the plugin store key `quota-samples`; malformed stored rows SHALL be ignored.

#### Scenario: New window
- **WHEN** the reset time moves
- **THEN** the older samples are dropped

#### Scenario: Thinned
- **WHEN** the newest sample is less than the window divided by 240 after the sample before it, and a reading comes
- **THEN** the reading replaces the newest sample, so minute readings keep 2-minute samples for 5h and about 42-minute ones for 7d, and a week of them reaches a 7-day burn rate

### Requirement: Context meter
The pane's Context row SHALL read `<bar 10> <pct>%  <used>/<window>`, with tokens written as `84k` or
`1.2M`. Its colour SHALL be green under 60%, orange from 60% to 79%, and red from 80%. It SHALL be absent
without a token count or window.

#### Scenario: Colour
- **WHEN** context is at 70%
- **THEN** the Context row is orange and reads `▰▰▰▰▰▰▰▱▱▱ 70%` followed by used/window

#### Scenario: Near full
- **WHEN** context is at 85%
- **THEN** the band shows the near-full row, and in a desk the Context row is red

### Requirement: Desk pane
In a desk, in an interactive session or once a surface attaches (the VS Code extension and the desktop
app run the SDK: not interactive, the editor attaches later), the plugin SHALL open a pane titled `Desk`,
registering `/desk` and `/decide` and starting the refresh timer once however many starts and attaches
occur.

#### Scenario: Non-interactive
- **WHEN** the session is not interactive and no surface attaches
- **THEN** no pane, command or refresh timer is started

#### Scenario: SDK host
- **WHEN** a session starts not interactive and a `vscode` surface then attaches
- **THEN** `/desk` and `/decide` are registered and the pane opens

#### Scenario: Interactive session with an attach
- **WHEN** an interactive session has a surface attach
- **THEN** commands are registered and the timer started once

### Requirement: Desk pane rows
The pane SHALL show these rows, each a label and a value, and SHALL leave out any row whose value is unknown. The rows are those of the Row list scenario.

#### Scenario: Row list
| Row | Value |
|---|---|
| Context | the context meter |
| Quota | the quota meter |
| Cache | the cache meter, then the output style on the same row |
| Style | the session's output style name, or `default`; its own row only while the cache meter is unknown |
| Warm | a Button labelled `auto` or `off`, then why: the warm-hold reason, `idle`, or `off for this session` |
| Tokens | today's calls, fresh and cached tokens, once the status is read; `unavailable` when it has no value |
| Roots | one dim line per root, once the status is read; `none` when empty |

#### Scenario: Unknown row left out
- **WHEN** a row's value is unknown
- **THEN** the pane leaves that row out

#### Scenario: Seen from any tab
- **WHEN** any tab is open
- **THEN** Tokens and Roots show, and no tab repeats them

### Requirement: Desk pane footer
Under the tabs the pane SHALL show the status time. The pane SHALL NOT draw the status text, nor the notice that status text is data, which is for agents.

#### Scenario: Footer
- **WHEN** the pane is drawn after a status result
- **THEN** the status time appears under the tabs, and no `never approval` wording

### Requirement: Desk pane CI and verdict colours
A branch's state word SHALL be the `state` of `desk status --json`, which the pane colours and ranks and does not recompute: green for `ready`, red for `CI failed` and `fixes needed`, orange for every other word.

#### Scenario: A pass on an older commit
- **WHEN** the CLI reports `CI stale` or `needs review` for a branch
- **THEN** its state word is orange, not green

#### Scenario: Behind the default branch
- **WHEN** the CLI reports `rebase`
- **THEN** its state word is `rebase`, in orange

### Requirement: Desk pane refresh
The pane SHALL read everything under the rows from one `desk status --json` run. It runs at start and every 60 seconds, with a 45 s timeout. It SHALL show `Loading desk status…` until the first result. A failing run or unparsable output SHALL show its stderr or `desk status failed: <error>`.

#### Scenario: Further rules
Every 2 seconds the pane SHALL stat `todo.jsonl`, `board.jsonl` and `decisions.jsonl` in the desk, and when the size or mtime of one differs from what the last run started on, run `desk status --cached --json`. One run SHALL go at a time: a request during a run SHALL cause one more run after it, a plain one if any request was plain. The pane SHALL NOT watch while no desk path is known; the 60 second run stays.

#### Scenario: Reads JSON, not text
- **WHEN** the pane refreshes
- **THEN** it runs `desk status --json`, draws from its fields, and no line of the status text appears

#### Scenario: A local change
- **WHEN** a look finds `todo.jsonl` changed
- **THEN** `desk status --cached --json` runs once, and the next look with nothing changed runs nothing

#### Scenario: A burst during a run
- **WHEN** a run is in flight and refreshes are asked meanwhile, one of them plain
- **THEN** exactly one more run follows, the plain one

### Requirement: Desk detection
A desk SHALL be detected by `desk home` exiting 0.

#### Scenario: Home exits 0
- **WHEN** `desk home` exits 0
- **THEN** the session is in a desk

### Requirement: /desk and /decide
The plugin SHALL register `/desk`, which opens the pane and answers `Desk pane opened.`, and `/decide [T-n <ruling> | T-n --pick <n> | --list [n]]`. With arguments it runs `desk decide` with them (a ruling is one argument; text after the id that starts with the flag `--pick` is split on whitespace, so the CLI reads the flag and refuses a bad value) and returns its output.

#### Scenario: Further rules
Without, where `$.session.surfaces()` lists a surface and `desk decide --json` gives a decision with 2 to 4 options, it SHALL start the Decide walk below, as the Decide Button does, and answer at once, without waiting for the owner, `Decisions: answer in the dialog. If none opens, use /decide T-n <ruling> or desk decide.`, since a rule denying the dialog looks like a dismissal; the owner closing the dialog SHALL record nothing and toast nothing. Otherwise (none waiting, fewer than 2 or more than 4 options, output that is not JSON, no surface listed as in a `-p` run, or the call fails) it SHALL return the printed `desk decide` text and open no dialog. `$.ui.ask` rejects alike on dismissal and with no one to ask, so the surfaces list, not the rejection, tells them apart. After a recorded ruling the pane SHALL refresh at once.

#### Scenario: Record a ruling
- **WHEN** the user runs `/decide T-5 use option b`
- **THEN** `desk decide T-5 "use option b"` runs and the pane refreshes

#### Scenario: A mistyped pick is refused
- **WHEN** the user runs `/decide T-5 --pick two`, `/decide T-5 --pick <2>`, `/decide T-5 --pick` or `/decide T-5 --pick 2 extra`
- **THEN** `desk decide` receives the flag and each word as separate arguments and refuses them, nothing is recorded and T-5 stays open

#### Scenario: Typed /decide opens the dialog
- **WHEN** the user runs `/decide` with no arguments, a surface draws, and T-5 waits with two options
- **THEN** the same dialog as the Decide Button's opens, and the chosen label is recorded as `desk decide T-5 "<label>"`

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

### Requirement: Decide walk with options
A decision read from `desk decide --json` with 2 to 4 options SHALL be asked in the engine's question dialog through `$.ui.ask`, its text holding the question, the context and each option's why, and its choices the option labels. `$.ui.ask` takes labels only and no document covers a plugin calling `AskUserQuestion` with per-option descriptions, so the whys stay in the question text. This is a parity gap: the VS Code extension shows each why on the option's own row.

#### Scenario: Further rules
The chosen label as it is, or the text typed under Other after redaction, SHALL be recorded as `desk decide <id> <ruling>`, the ruling one argument (on one line, cut to 1000 characters), the pane SHALL refresh, and the walk SHALL go on with a fresh read of the next decision.

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

### Requirement: Masked answer is announced
When redaction changes the text typed under Other in the Decide dialog and the ruling is recorded, the pane SHALL toast that the answer was masked, without the typed text or the secret.

#### Scenario: Masked text is announced
- **WHEN** redaction changes the text typed under Other and the ruling is recorded
- **THEN** a toast says the answer was masked, without the typed text or the secret; text redaction leaves unchanged shows no toast

### Requirement: Decide walk without options
A decision with fewer than 2 or more than 4 options SHALL show its text and the answer command in a toast and, where
the surface's prompt box takes it, fill an empty prompt with `/decide <id> `. The walk SHALL end there.

#### Scenario: Press /decide
- **WHEN** the user presses `Decide (1)`, T-5 has no options, or more than 4, and the prompt is empty
- **THEN** a toast shows the decision, no dialog opens and the prompt holds `/decide T-5 `

#### Scenario: No choices to offer, draft
- **WHEN** T-5 has no options, or more than 4, and the prompt holds a draft
- **THEN** a toast shows the decision and the draft is unchanged

### Requirement: Decide walk ends
A declined or refused dialog SHALL record nothing and fill nothing, and SHALL end the walk with a toast of the
reason. A record that fails SHALL end the walk with a toast of `desk decide`'s output.

#### Scenario: Declined
- **WHEN** the owner closes the dialog for T-5
- **THEN** nothing is recorded, nothing is filled, a toast gives the reason and no next question follows

#### Scenario: Ruled elsewhere
- **WHEN** another session rules T-5 while its dialog is open and the owner then chooses an option
- **THEN** `desk decide` refuses, its output is shown in a toast and the walk ends

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

#### Scenario: A newer id than the status's
- **WHEN** the status lists T-5 first and `desk decide --json` returns T-60
- **THEN** the dialog asks T-60 and the ruling is recorded on T-60, not T-5

#### Scenario: Press with a draft
- **WHEN** the prompt holds a draft and the owner presses `Decide (1)` and chooses an option
- **THEN** the ruling is recorded and the draft is unchanged

#### Scenario: Second press
- **WHEN** the owner presses `Decide (1)` while its dialog is open
- **THEN** no second dialog opens

### Requirement: Compaction toast
After a pruned automatic compaction in the main session, the plugin SHALL toast `agent-desk: tool
output cut, context −<n>%, messages kept as written`. Subagent compactions SHALL show no toast.

#### Scenario: Main session
- **WHEN** an automatic compaction is replaced by a prune saving 41%
- **THEN** the toast shows `−41%`

### Requirement: Cache meter
The pane's Cache row SHALL show `<n>% hit`, which is cache reads over all input across the main
session's turns. It SHALL show no dollar amount (cost differs by plan). It SHALL be absent before the
first turn.

#### Scenario: Half from cache
- **WHEN** half the input came from cache
- **THEN** the row is `50% hit`

### Requirement: Meter bars
Meters SHALL draw a bar of `width` cells, `round(clamp(pct, 0, 100) / 100 × width)` filled `▰`, and the
rest empty `▱`. The percent SHALL always follow the bar, so neither glyphs nor colour is the only signal.
Widths: 8 for context on the status line and the band, 4 for quota on the status line, and 10 in the pane.

#### Scenario: Rounding
- **WHEN** 42% is drawn 8 wide
- **THEN** the bar is `▰▰▰▱▱▱▱▱`

#### Scenario: Out of range
- **WHEN** the percent is below 0 or above 100
- **THEN** the bar is all empty or all filled, and never longer than its width

### Requirement: Keep-warm toggle
In a desk the plugin SHALL offer a keep-warm mode, `auto` or `off`. The default is `auto`. The mode
SHALL be kept for the session only (a session `$.state` atom, never `$.store`). Only the pane's Warm
Button `onPress` SHALL change it. While it is `off`, warm-hold SHALL neither ping nor arm.

#### Scenario: Turn it off
- **WHEN** the user presses the Warm Button while it reads `auto`
- **THEN** it reads `off`, the status line shows `warm off`, and the Warm row says `off for this session`

#### Scenario: A new session
- **WHEN** a session starts after a session that turned it off
- **THEN** the mode is `auto`

### Requirement: Active todo row
On the Work and Todos tabs, each todo SHALL take at most three rows: `<id> <summary>` (`<id> <title>` when none), then `state:` and `next:` when set, each cut at the edge and never wrapped. On the Todos tab the id row SHALL carry one label: the status unless it is `open`, then `wt:<slug>`, else the owner, else the area. On the Work tab the id row SHALL carry none, since it sits under its branch or claim.

#### Scenario: Summary
- **WHEN** a todo has a summary
- **THEN** its row reads `<id> <summary>`, not the title

#### Scenario: No summary
- **WHEN** a todo has no summary
- **THEN** its row reads `<id> <title>`, truncated at the edge

#### Scenario: Long title
- **WHEN** the summary or title is wider than the pane and the todo has a slug
- **THEN** the head is cut at the edge (`truncate-end`) and `wt:<slug>` stays visible

#### Scenario: Owner label
- **WHEN** a todo on the Todos tab has an owner and no slug
- **THEN** the row's label is the owner

#### Scenario: Status in the label
- **WHEN** a todo on the Todos tab is blocked and has an owner
- **THEN** the row's label reads `blocked · <owner>`

#### Scenario: No label
- **WHEN** a todo shows on the Work tab, or on the Todos tab open with no slug, owner or area
- **THEN** the row shows no label

#### Scenario: Other fields
- **WHEN** the todo has a model, size or priority
- **THEN** none of them appears on the row

### Requirement: Desk pane row colours
The pane SHALL colour what needs attention and SHALL keep every word, so colour is never the only signal. The Quota row SHALL use the Context row's thresholds on its highest window. Warm's reason SHALL be orange while keep-warm is off. Todo ids, `wt:<slug>` labels, agent types and tree and branch slugs SHALL use one accent colour. A todo's `next:` SHALL not be dim.

#### Scenario: Further rules
A pull request row SHALL be red for changes requested, green when approved with no unresolved thread and nothing new since the head commit, and orange otherwise.

#### Scenario: Quota near its limit
- **WHEN** a quota window reaches 80%
- **THEN** the Quota row is red, whatever the other windows read

### Requirement: Desk pane card and tab marks
The Open branches, Pull requests and Overlaps cards SHALL take the border of the worst status inside them (red over orange over green), and stay dim when empty. The Work tab SHALL show a red dot while any of those cards is red, and no dot for orange, which any branch in progress reads. The Decisions tab SHALL show a yellow dot while a decision waits, and its card a yellow border.

#### Scenario: A failing branch seen from another tab
- **WHEN** a branch's CI failed and the Todos tab is open
- **THEN** a red dot shows beside the Work tab, and on that tab the Open branches card has a red border

#### Scenario: Nothing to report
- **WHEN** there are no open branches, pull requests or overlaps
- **THEN** those cards keep their dim border and the Work tab shows no dot

#### Scenario: A branch in progress
- **WHEN** a branch has no verdict yet and nothing is red
- **THEN** the Open branches card has an orange border and the Work tab shows no dot

### Requirement: Desk pane headline
Above the tabs the pane SHALL show one line counting the open branches that are ready or wait on someone, in the colour of the worst of them.

#### Scenario: Only what is not zero
- **WHEN** one branch is ready, one needs review and one needs fixes
- **THEN** the line reads `1 ready to merge · 1 needs review · 1 fixes needed` in red

#### Scenario: Nothing to count
- **WHEN** every open branch is in progress, or there are none
- **THEN** no line is drawn

### Requirement: Desk pane merge policy
The Desk pane SHALL show the PR state from `desk status --json` for a `review` branch, on the Pull requests card when `prs` lists the branch and on the row otherwise, and `review` on that repo's Roots line. A `direct` repo's rows SHALL not change, and verdict colours SHALL not change.

#### Scenario: Waiting for a person
- **WHEN** a `review` branch has an open PR and a `MERGE` verdict
- **THEN** the PR shows as open, on the Pull requests card when `prs` lists the branch and on the row otherwise, and the verdict is not coloured as a failure

#### Scenario: Merged on the server
- **WHEN** a `review` branch's PR is merged
- **THEN** the row names `desk wt merge <slug>`

### Requirement: Desk pane three tabs
Below the rows and the headline, the pane SHALL show three tab Buttons, Decisions, Work (the default) and Todos, each with its count,
and only the open tab's sections, each a bordered card with a heading over its lines, `none` when empty
and `unavailable` when the status has no value for it. A tab value stored by an older version SHALL be dropped, so the pane opens on Work.

#### Scenario: A closed tab
- **WHEN** the Work tab is open
- **THEN** no decision or Todos row is drawn until its tab is pressed

#### Scenario: The Work label
- **WHEN** two branches and one claim with no branch are open
- **THEN** the second tab reads `Work 3`

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

### Requirement: Desk pane Work tab
The Work tab SHALL hold what is in progress, in this order: Open branches, Agents, Pull requests, Overlaps, Running sessions. An open PR SHALL be said on the Pull requests card (with `a person merges`) and not again on its branch row. Open branches SHALL hold one row for each branch and each claim with no branch, a claim's row as `<slug> · <from> · claimed <age>`, then ` · last post <age>` when known, and under a row the active todos on that slug.

#### Scenario: Further rules
A value the row above already says SHALL not repeat.

#### Scenario: The slug once
- **WHEN** a todo sits under its branch, or a session has a slug
- **THEN** neither carries a `wt:<slug>` label

#### Scenario: Agents
- **WHEN** two agents run
- **THEN** the Work tab's Agents lists two lines, each `<type> · <description> · <age>`; with none running or pending the card is not drawn

#### Scenario: This session's agents once
- **WHEN** Agents lists this session's agents
- **THEN** its Running sessions row leaves them out; when Agents lists none, that row names them

#### Scenario: Pull requests unknown
- **WHEN** the status has no pull request data
- **THEN** the Pull requests card is not drawn

#### Scenario: A running session
- **WHEN** a session has a title, a claimed worktree and two agents
- **THEN** its row shows the title, then a dim `<id> · 2 agents`, then one line per agent as `<type> · <about>`, each cut at the edge

#### Scenario: A session with no title
- **WHEN** a session has no title
- **THEN** its id names the row (its slug is on its branch row), and the footnote does not repeat that id

#### Scenario: This session
- **WHEN** a session's id begins this session's id
- **THEN** its row is marked `this session`

#### Scenario: This session's agents show once
- **WHEN** the engine lists this session's agents
- **THEN** the Agents card shows them and this session's Running sessions row does not

#### Scenario: Rows
- **WHEN** two agents run, one worktree with no branch is claimed and nothing waits
- **THEN** Agents lists two lines, Open branches lists the claim, and no decision or Decide Button is shown

#### Scenario: A branch row
- **WHEN** a branch is drawn
- **THEN** its row shows the slug, one state word (`CI failed`, `fixes needed`, `rebase`, `needs review`, `not pushed`, `ready`, `CI running`, `CI stale`, `no CI yet` or `CI unknown`), the holder of its claim when it has one, and the short head

#### Scenario: Most urgent first
- **WHEN** branches need action, are ready and are in progress
- **THEN** they come in that order

#### Scenario: A second line only when it adds
- **WHEN** a branch is behind, or has a verdict its state word does not already say
- **THEN** a dim line under the row says so, and a ready branch has none

#### Scenario: Overlaps grouped by file
- **WHEN** five files overlap between open branches
- **THEN** the card lists the three on the most branches as `<file> · <n> branches`, then `+2 more`

#### Scenario: A todo on a branch
- **WHEN** an active todo's slug has a branch
- **THEN** it shows under that branch's row, once, and not on the Todos tab

### Requirement: Desk pane Todos tab
The Todos tab SHALL list the `todos` of `desk status --json` in the order given, at most ten, then `+<n> more`. With none it SHALL read `No open todos`.

#### Scenario: Many open
- **WHEN** thirteen todos are open
- **THEN** the tab reads `Todos 13`, the first ten show, and `+3 more` follows

### Requirement: Panels in both surfaces
The pane and the VS Code extension SHALL show the same three panels, Decisions, Work and Todos, in that order, from the same fields of `desk status --json`. The only differences SHALL be the gaps these scenarios state.

#### Scenario: Same order
- **WHEN** both surfaces show a desk
- **THEN** each reads Decisions, Work, Todos

#### Scenario: Shown once
- **WHEN** an active todo is on a branch or claim
- **THEN** both surfaces show it in Work and not in Todos; a blocked or open todo with a slug is in Todos

#### Scenario: Gap, how the panels open
- **WHEN** the panels are drawn
- **THEN** the pane has tabs, one open at a time with dots on closed ones, because the engine has no collapsible element and the dock's rows are few; the extension has collapsible stacked views

#### Scenario: Gap, the Todos cap
- **WHEN** more than ten todos are open
- **THEN** the pane shows ten and `+n more`; the extension shows every todo, because a tree scrolls

#### Scenario: Gap, what only the pane shows
- **WHEN** both surfaces show a desk
- **THEN** the meters, Tokens, Roots and Agents are on the pane and not in the extension; the meters, Tokens and Roots are options T-144 left out, and Agents is the engine's live list, which the extension cannot reach (the status holds only each session's agents, shown under Running sessions)

#### Scenario: Gap, a todo's state and next
- **WHEN** a todo has `state` or `next`
- **THEN** the pane shows them on rows; the extension in the tooltip, because a tree row has one line

#### Scenario: Gap, empty Work
- **WHEN** nothing is in progress
- **THEN** the pane shows `none` per card; the extension one row, `Nothing in progress`, because a tree hides empty sections

#### Scenario: Gap, the Decide walk
- **WHEN** Decide is pressed
- **THEN** the pane walks in a dialog; the extension in a quick pick

#### Scenario: Gap, an older CLI
- **WHEN** the status has no `todos`
- **THEN** the extension refuses it and names what to update; the pane renders anyway and shows its Todos tab as `Todos ?` over `unavailable`, not as zero todos
