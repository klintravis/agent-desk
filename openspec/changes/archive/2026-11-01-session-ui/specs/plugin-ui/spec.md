## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: One status line
The plugin SHALL draw one status line of its own, joined by ` · `, from these slots in order:
1. `ctx <bar 8> <pct>%`.
2. `<name> <bar 4> <pct>%` for the `5h` window, else the first window in quota order.
3. `warm auto` or `warm off`, in a desk only.
4. `⚑ <n>`, in a desk only and only when n decisions wait and n > 0.

The line SHALL be cleared when all slots are empty. It SHALL carry no cache meter, no near-full hint and
no warm-hold reason. The meters SHALL be read after every main-session turn and once a minute. Meters
SHALL show outside a desk too.

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
In a desk and an interactive session the plugin SHALL open a pane titled `Desk`. The pane SHALL show
these rows, each a label and a value, and SHALL leave out any row whose value is unknown:

| Row | Value |
|---|---|
| Context | the context meter |
| Quota | the quota meter |
| Cache | the cache meter |
| Style | the session's output style name, or `default` when there is none |
| Warm | a Button labelled `auto` or `off`, then why: the warm-hold reason, `idle`, or `off for this session` |
| Agents | each running or pending agent as `<type> · <description> · <age>`, or `none` |
| Trees | each open claim as `<slug> · <from> · claimed <age>`, or `none` |
| Decide | each waiting decision as `<id> <title>` and a `/decide` Button, or `none` |

Below the rows it SHALL show `── desk status ──` and the status text, with `#` lines in bold.

The pane SHALL read the Trees, Decide and status text from one `desk status --json` run. It runs at
start and every 60 seconds, with a 45 s timeout. It SHALL show `Loading desk status…` until the first
result. A failing run or unparsable output SHALL show its stderr or `desk status failed: <error>`.

A desk SHALL be detected by `desk home` exiting 0.

#### Scenario: Rows
- **WHEN** two agents run, one worktree is claimed and nothing waits
- **THEN** Agents lists two lines, Trees lists one, and Decide reads `none` with no Button

#### Scenario: Reads JSON, not text
- **WHEN** the pane refreshes
- **THEN** it runs `desk status --json` and takes the decisions and claims from its fields, not from the text

#### Scenario: Non-interactive
- **WHEN** the session is not interactive
- **THEN** no pane, command or refresh timer is started

### Requirement: Decisions band
A band above the prompt SHALL show only what needs acting on:
- in a desk, `⚑ <n> decision(s) waiting` with a `/decide` Button, when n > 0, where n is the status
  JSON's `decisions` count;
- in any session, `ctx <bar 8> <pct>%  near full: handoff or /compact`, when context is 80% or more.

The band SHALL be hidden while a survey is shown, and when neither row applies.

#### Scenario: Two waiting
- **WHEN** two decisions wait and context is under 80%
- **THEN** the band reads `⚑ 2 decisions waiting` with a `/decide` Button and no ctx row

#### Scenario: Press /decide
- **WHEN** the user presses the band's `/decide` Button
- **THEN** `/decide` runs as if typed

#### Scenario: Near full only
- **WHEN** nothing waits and context is at 84%
- **THEN** the band reads `ctx ▰▰▰▰▰▰▰▱ 84%  near full: handoff or /compact`

### Requirement: Cache meter
The pane's Cache row SHALL show `<n>% hit`, which is cache reads over all input across the main
session's turns. It SHALL show no dollar amount (cost differs by plan). It SHALL be absent before the
first turn.

#### Scenario: Half from cache
- **WHEN** half the input came from cache
- **THEN** the row is `50% hit`
