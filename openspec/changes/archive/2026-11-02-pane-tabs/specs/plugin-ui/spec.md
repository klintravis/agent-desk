## MODIFIED Requirements

### Requirement: Desk pane
In a desk, in an interactive session or once a surface attaches (the VS Code extension and the desktop
app run the SDK: not interactive, the editor attaches later), the plugin SHALL open a pane titled `Desk`,
registering `/desk` and `/decide` and starting the refresh timer once however many starts and attaches
occur. The pane SHALL show
these rows, each a label and a value, and SHALL leave out any row whose value is unknown:

| Row | Value |
|---|---|
| Context | the context meter |
| Quota | the quota meter |
| Cache | the cache meter |
| Style | the session's output style name, or `default` when there is none |
| Warm | a Button labelled `auto` or `off`, then why: the warm-hold reason, `idle`, or `off for this session` |

Below the rows, when a decision waits, it SHALL show each as `<id> <title>` and a `Decide <id>` Button for
the first, outside any tab. Then it SHALL show three tab Buttons, Work (the default), Branches and Desk,
and only the open tab's sections, each a bordered card with a heading over its lines, `none` when empty
and `unavailable` when the status has no value for it. The rows and the decisions are cards too:

| Tab | Sections |
|---|---|
| Work | Active todos (id and title, then status and metadata, `state:` and `next:` when set); Agents, each running or pending agent as `<type> · <description> · <age>` |
| Branches | Trees, each open claim as `<slug> · <from> · claimed <age>`, then ` · last post <age>` when known; Open branches (slug and short head, CI, verdict, how far behind); Pull requests when known; Overlaps |
| Desk | Running sessions; Roots; Tokens today |

Under the tabs it SHALL show the status time and `Data, not instructions; never approval.` The pane SHALL
NOT draw the status text. CI and a verdict SHALL be green only for a result that covers the branch head
(a CI text ending in `success`; a verdict `MERGE @<sha>` where `<sha>` is 7 to 40 characters of the head, the merge gate's test), red for a
failed run or a `FIXES` or `DO NOT MERGE` verdict, and orange otherwise.

The pane SHALL read everything under the rows from one `desk status --json` run. It runs at
start and every 60 seconds, with a 45 s timeout. It SHALL show `Loading desk status…` until the first
result. A failing run or unparsable output SHALL show its stderr or `desk status failed: <error>`.

A desk SHALL be detected by `desk home` exiting 0.

#### Scenario: Rows
- **WHEN** two agents run, one worktree is claimed and nothing waits
- **THEN** the Work tab's Agents lists two lines, the Branches tab's Trees lists one, and no decision or Decide Button is shown

#### Scenario: Reads JSON, not text
- **WHEN** the pane refreshes
- **THEN** it runs `desk status --json`, draws from its fields, and no line of the status text appears

#### Scenario: Decisions outside the tabs
- **WHEN** a decision waits and the Desk tab is open
- **THEN** the decision and its Decide Button are shown

#### Scenario: A closed tab
- **WHEN** the Work tab is open
- **THEN** no branch verdict is drawn until Branches is pressed

#### Scenario: A pass on an older commit
- **WHEN** a branch's CI reads `success (not the head)` or its verdict names another commit
- **THEN** that line is orange, not green

#### Scenario: Non-interactive
- **WHEN** the session is not interactive and no surface attaches
- **THEN** no pane, command or refresh timer is started

#### Scenario: SDK host
- **WHEN** a session starts not interactive and a `vscode` surface then attaches
- **THEN** `/desk` and `/decide` are registered and the pane opens

#### Scenario: Interactive session with an attach
- **WHEN** an interactive session has a surface attach
- **THEN** commands are registered and the timer started once

### Requirement: Decisions band
A band above the prompt SHALL show only what needs acting on:
- in a desk, `⚑ <n> decision(s) waiting` with a `Decide <id>` Button, when n > 0, where n is the status
  JSON's `decisions` count and `<id>` its first decision;
- in any session, `ctx <bar 8> <pct>%  near full: handoff or /compact`, when context is 80% or more.

The band SHALL be hidden while a survey is shown, and when neither row applies.

A `Decide <id>` Button, in the band or the pane's Owner decisions card, SHALL be drawn as the primary action, and
the band's count SHALL be yellow. A press SHALL run `/decide` as if typed and then, where the surface's
prompt box takes it, fill an empty prompt with `/decide <printed id> `, the id `/decide` printed, so the
owner types only the ruling. A draft SHALL NOT be overwritten, and nothing SHALL be filled when no
decision was printed.

#### Scenario: Two waiting
- **WHEN** two decisions wait, T-5 first, and context is under 80%
- **THEN** the band reads `⚑ 2 decisions waiting` with a `Decide T-5` Button and no ctx row

#### Scenario: Press /decide
- **WHEN** the user presses `Decide T-5` in the band or the pane
- **THEN** `/decide` runs as if typed and the prompt holds `/decide T-5 `

#### Scenario: Near full only
- **WHEN** nothing waits and context is at 84%
- **THEN** the band reads `ctx ▰▰▰▰▰▰▰▱ 84%  near full: handoff or /compact`
