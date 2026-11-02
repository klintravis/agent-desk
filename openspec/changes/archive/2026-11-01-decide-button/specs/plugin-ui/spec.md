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
| Agents | each running or pending agent as `<type> · <description> · <age>`, or `none` |
| Trees | each open claim as `<slug> · <from> · claimed <age>`, or `none` |
| Decide | each waiting decision as `<id> <title>` and a `Decide <id>` Button for the first, or `none` |

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

A `Decide <id>` Button, in the band or the pane's Decide row, SHALL be drawn as the primary action, and
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
