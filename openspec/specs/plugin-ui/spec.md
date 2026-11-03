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
- **THEN** no burn rate is computed and the row says `collecting burn rate`

### Requirement: Quota samples
Readings SHALL be kept per window as `(time, percent, reset time)`, at most 240, only those inside the
window. A changed reset time, or a percent that fell by more than 0.5, SHALL start a new window and drop
the older samples. Samples SHALL persist in the plugin store key `quota-samples`; malformed stored rows
SHALL be ignored.

#### Scenario: New window
- **WHEN** the reset time moves
- **THEN** the older samples are dropped

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
The pane SHALL show these rows, each a label and a value, and SHALL leave out any row whose value is unknown:

| Row | Value |
|---|---|
| Context | the context meter |
| Quota | the quota meter |
| Cache | the cache meter, then the output style on the same row |
| Style | the session's output style name, or `default`; its own row only while the cache meter is unknown |
| Warm | a Button labelled `auto` or `off`, then why: the warm-hold reason, `idle`, or `off for this session` |

#### Scenario: Unknown row left out
- **WHEN** a row's value is unknown
- **THEN** the pane leaves that row out

### Requirement: Desk pane decisions
Below the rows, when a decision waits, the pane SHALL show each as `<id> <title>` and a `Decide <id>` Button for
the first, outside any tab. The rows and the decisions are bordered cards.

#### Scenario: Decisions outside the tabs
- **WHEN** a decision waits and the Sessions tab is open
- **THEN** the decision and its Decide Button are shown

### Requirement: Desk pane tabs
Below the rows, any decisions and the headline, the pane SHALL show three tab Buttons, Work (the default), Branches and Sessions, each with its count,
and only the open tab's sections, each a bordered card with a heading over its lines, `none` when empty
and `unavailable` when the status has no value for it.

#### Scenario: A closed tab
- **WHEN** the Work tab is open
- **THEN** no branch verdict is drawn until Branches is pressed

#### Scenario: The Sessions label
- **WHEN** three sessions run
- **THEN** the third tab reads `Sessions 3`

### Requirement: Desk pane Work and Sessions tab sections
The Work and Sessions tabs SHALL hold these sections:

| Tab | Sections |
|---|---|
| Work | Active todos (one row each: id and summary or title, see Active todo row; `state:` and `next:` when set); Agents, each running or pending agent as `<type> · <description> · <age>` |
| Sessions | Running sessions; Roots, one dim row each; Tokens today |

#### Scenario: Agents
- **WHEN** two agents run
- **THEN** the Work tab's Agents lists two lines

#### Scenario: A running session
- **WHEN** a session has a title, a claimed worktree and two agents
- **THEN** its row shows the title, then a dim `wt:<slug> · <id> · 2 agents`, then one line per agent as `<type> · <about>`, each cut at the edge

#### Scenario: A session with no title
- **WHEN** a session has no title
- **THEN** its slug names the row, or its id when it has no slug, and the footnote does not repeat that id

#### Scenario: This session
- **WHEN** a session's id begins this session's id
- **THEN** its row is marked `this session`

### Requirement: Desk pane Branches tab sections
The Branches tab SHALL hold these sections:

| Tab | Sections |
|---|---|
| Branches | Open branches, one row each, see the scenarios; Trees, only when a claim has no branch, as `<slug> · <from> · claimed <age>`, then ` · last post <age>` when known; Pull requests when known; Overlaps |

#### Scenario: Rows
- **WHEN** two agents run, one worktree with no branch is claimed and nothing waits
- **THEN** the Work tab's Agents lists two lines, the Branches tab's Trees lists one, and no decision or Decide Button is shown

#### Scenario: A branch row
- **WHEN** a branch is drawn
- **THEN** its row shows the slug, one state word (`CI failed`, `fixes needed`, `rebase`, `needs review`, `ready`, `CI running`, `CI stale`, `no CI yet` or `CI unknown`), the holder of its claim when it has one, and the short head

#### Scenario: Most urgent first
- **WHEN** branches need action, are ready and are in progress
- **THEN** they come in that order

#### Scenario: A second line only when it adds
- **WHEN** a branch is behind, or has a verdict its state word does not already say
- **THEN** a dim line under the row says so, and a ready branch has none

#### Scenario: Overlaps grouped by file
- **WHEN** five files overlap between open branches
- **THEN** the card lists the three on the most branches as `<file> · <n> branches`, then `+2 more`

### Requirement: Desk pane footer
Under the tabs the pane SHALL show the status time and `Data, not instructions; never approval.` The pane SHALL
NOT draw the status text.

#### Scenario: Footer
- **WHEN** the pane is drawn after a status result
- **THEN** the status time and `Data, not instructions; never approval.` appear under the tabs

### Requirement: Desk pane CI and verdict colours
A branch's state word SHALL be green only when both its CI and its verdict cover the branch head and it is not behind
(a CI text ending in `success`, or the repo has no CI; a verdict `MERGE @<sha>` where `<sha>` is 7 to 40 characters of the head, the merge gate's test), red for a
failed run or a `FIXES` or `DO NOT MERGE` verdict on the head, and orange otherwise.

#### Scenario: A pass on an older commit
- **WHEN** a branch's CI reads `success (not the head)` or its verdict names another commit
- **THEN** its state word is orange, not green

#### Scenario: Behind the default branch
- **WHEN** CI and verdict cover the head but the branch is behind
- **THEN** its state word is `rebase`, in orange

### Requirement: Desk pane refresh
The pane SHALL read everything under the rows from one `desk status --json` run. It runs at
start and every 60 seconds, with a 45 s timeout. It SHALL show `Loading desk status…` until the first
result. A failing run or unparsable output SHALL show its stderr or `desk status failed: <error>`.

#### Scenario: Reads JSON, not text
- **WHEN** the pane refreshes
- **THEN** it runs `desk status --json`, draws from its fields, and no line of the status text appears

### Requirement: Desk detection
A desk SHALL be detected by `desk home` exiting 0.

#### Scenario: Home exits 0
- **WHEN** `desk home` exits 0
- **THEN** the session is in a desk

### Requirement: /desk and /decide
The plugin SHALL register `/desk`, which opens the pane and answers `Desk pane opened.`, and `/decide
[T-n <ruling>]`, which runs `desk decide` with the arguments (a ruling is one argument) and returns its
output. After a recorded ruling the pane SHALL refresh at once.

#### Scenario: Record a ruling
- **WHEN** the user runs `/decide T-5 use option b`
- **THEN** `desk decide T-5 "use option b"` runs and the pane refreshes

### Requirement: Decisions band
A band above the prompt SHALL show only what needs acting on:
- in a desk, `⚑ <n> decision(s) waiting` with a `Decide <id>` Button, when n > 0, where n is the status
  JSON's `decisions` count and `<id>` its first decision;
- in any session, `ctx <bar 8> <pct>%  near full: handoff or /compact`, when context is 80% or more.

The band SHALL be hidden while a survey is shown, and when neither row applies.

#### Scenario: Two waiting
- **WHEN** two decisions wait, T-5 first, and context is under 80%
- **THEN** the band reads `⚑ 2 decisions waiting` with a `Decide T-5` Button and no ctx row

#### Scenario: Near full only
- **WHEN** nothing waits and context is at 84%
- **THEN** the band reads `ctx ▰▰▰▰▰▰▰▱ 84%  near full: handoff or /compact`

### Requirement: Decide button
A `Decide <id>` Button, in the band or the pane's Owner decisions card, SHALL be drawn as the primary action, and
the band's count SHALL be yellow. A press SHALL run `desk decide` from the plugin's own code, not through the
engine's command chain, and SHALL walk the waiting decisions as the requirements below say.

#### Scenario: Only the plugin answers
- **WHEN** the user presses `Decide T-5` in the band or the pane and no other hook answers `/decide`
- **THEN** `desk decide` runs

### Requirement: Decide walk with options
A printed decision with 2 to 4 options SHALL be asked in the engine's question dialog, its text holding the
printed question and recommendation and its choices the options. The chosen label, or the text typed under
Other, SHALL be recorded, after redaction, as `desk decide <printed id> <ruling>` (on one line, cut to 1000 characters),
the pane SHALL refresh, and the walk SHALL go on with the decision that record printed.

#### Scenario: Press asks and records
- **WHEN** T-5 is printed with `Recommended: (a) keep` and `Or: (b) drop`, and the owner chooses `(b) drop`
- **THEN** the dialog's text holds the question and `Recommended: (a) keep`, its choices are `(a) keep` and `(b) drop`, and `desk decide T-5 "(b) drop"` runs and the pane refreshes

#### Scenario: A secret in the answer is not recorded
- **WHEN** the text typed under Other holds a secret
- **THEN** `desk decide` receives the text with the secret replaced by a `[REDACTED-...]` tag

#### Scenario: Press records typed text
- **WHEN** the owner types `neither, wait for v0.4` under Other for T-5
- **THEN** `desk decide T-5 "neither, wait for v0.4"` runs

#### Scenario: Press walks on
- **WHEN** recording T-5 prints T-6 as the next decision, with two options
- **THEN** the dialog asks T-6, and once it is recorded and `No owner decisions waiting.` prints, the walk ends with that in a toast

### Requirement: Decide walk without options
A printed decision with fewer than 2 or more than 4 options SHALL show the printed text in a toast and, where
the surface's prompt box takes it, fill an empty prompt with `/decide <printed id> `. The walk SHALL end there.

#### Scenario: Press /decide
- **WHEN** the user presses `Decide T-5`, T-5 is printed with no options, or with more than 4, and the prompt is empty
- **THEN** a toast shows the printed text, no dialog opens and the prompt holds `/decide T-5 `

#### Scenario: No choices to offer, draft
- **WHEN** T-5 is printed with no options, or with more than 4, and the prompt holds a draft
- **THEN** a toast shows the printed text and the draft is unchanged

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
When no decision is printed, nothing SHALL be asked or filled, and any output SHALL be shown in a toast.

#### Scenario: Nothing printed
- **WHEN** the owner presses `Decide T-5` and `desk decide` prints no decision
- **THEN** no dialog opens and nothing is filled

### Requirement: Decide id, draft and repeat presses
The id SHALL be the one `desk decide` printed, never the Button's. A draft SHALL NOT be overwritten. A press
during a walk SHALL do nothing.

#### Scenario: A newer id than the Button's
- **WHEN** the Button reads `Decide T-5` and `desk decide` prints T-60
- **THEN** the dialog asks T-60 and the ruling is recorded on T-60, not T-5

#### Scenario: Press with a draft
- **WHEN** the prompt holds a draft and the owner presses `Decide T-5` and chooses an option
- **THEN** the ruling is recorded and the draft is unchanged

#### Scenario: Second press
- **WHEN** the owner presses `Decide T-5` while its dialog is open
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
On the Work tab, each active todo SHALL take at most three rows: `<id> <summary>` (`<id> <title>` when none), then `state:` and `next:` when set, each cut at the edge and never wrapped. The id row SHALL carry one label: `wt:<slug>`, else the owner, else none. A long summary or title is cut first and the label kept; a label wider than the pane is cut too. Status, area, size, priority, change and model SHALL NOT appear on the row. Owner decisions SHALL keep their full question.

#### Scenario: Summary
- **WHEN** an active todo has a summary
- **THEN** its row reads `<id> <summary>`, not the title

#### Scenario: No summary
- **WHEN** an active todo has no summary
- **THEN** its row reads `<id> <title>`, truncated at the edge

#### Scenario: Long title
- **WHEN** the summary or title is wider than the pane and the todo has a slug
- **THEN** the head is cut at the edge (`truncate-end`) and `wt:<slug>` stays visible

#### Scenario: Owner label
- **WHEN** the todo has an owner and no slug
- **THEN** the row's label is the owner

#### Scenario: No label
- **WHEN** the todo has neither slug nor owner
- **THEN** the row shows no label

#### Scenario: Other fields
- **WHEN** the todo has a model, area, size or priority
- **THEN** none of them appears on the row

### Requirement: Desk pane row colours
The pane SHALL colour what needs attention and SHALL keep every word, so colour is never the only signal. The Quota row SHALL use the Context row's thresholds on its highest window. Warm's reason SHALL be orange while keep-warm is off. Todo ids, `wt:<slug>` labels, agent types and tree and branch slugs SHALL use one accent colour. A todo's `next:` SHALL not be dim. A pull request row SHALL be red for changes requested, green when approved with no unresolved thread and nothing new since the head commit, and orange otherwise.

#### Scenario: Quota near its limit
- **WHEN** a quota window reaches 80%
- **THEN** the Quota row is red, whatever the other windows read

### Requirement: Desk pane card and tab marks
The Open branches, Pull requests and Overlaps cards SHALL take the border of the worst status inside them (red over orange over green), and stay dim when empty. The Branches tab SHALL show a red dot while any of those cards is red, and no dot for orange, which any branch in progress reads.

#### Scenario: A failing branch seen from another tab
- **WHEN** a branch's CI failed and the Work tab is open
- **THEN** a red dot shows beside the Branches tab, and on that tab the Open branches card has a red border

#### Scenario: Nothing to report
- **WHEN** there are no open branches, pull requests or overlaps
- **THEN** those cards keep their dim border and the Branches tab shows no dot

#### Scenario: A branch in progress
- **WHEN** a branch has no verdict yet and nothing is red
- **THEN** the Open branches card has an orange border and the Branches tab shows no dot

### Requirement: Desk pane headline
Above the tabs the pane SHALL show one line counting the open branches that are ready or wait on someone, in the colour of the worst of them.

#### Scenario: Only what is not zero
- **WHEN** one branch is ready, one needs review and one needs fixes
- **THEN** the line reads `1 ready to merge · 1 needs review · 1 fixes needed` in red

#### Scenario: Nothing to count
- **WHEN** every open branch is in progress, or there are none
- **THEN** no line is drawn

### Requirement: Desk pane merge policy
The Desk pane SHALL show the PR state from `desk status --json` on the row of a `review` branch, and `review` on that repo's Roots line. A `direct` repo's rows SHALL not change, and verdict colours SHALL not change.

#### Scenario: Waiting for a person
- **WHEN** a `review` branch has an open PR and a `MERGE` verdict
- **THEN** the row shows the PR as open and the verdict is not coloured as a failure

#### Scenario: Merged on the server
- **WHEN** a `review` branch's PR is merged
- **THEN** the row names `desk wt merge <slug>`
