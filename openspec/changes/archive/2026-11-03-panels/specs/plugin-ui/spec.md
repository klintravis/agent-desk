## ADDED Requirements

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
The Decisions tab SHALL show each waiting decision as `<id> <title>`, then its options from `decisions[].options`: `Recommended: <label>` for the first and `Or: <label>` for the others, each followed by ` · <why>` when it has one. A `Decide <id>` Button for the first decision SHALL follow. With nothing waiting it SHALL read `No decisions waiting`, with no Button. While one waits, the tab Button SHALL show a yellow dot, so a closed tab hides no decision.

#### Scenario: A decision waits and the Work tab is open
- **WHEN** a decision waits and the Work tab is open
- **THEN** the tab reads `Decisions 1` with a yellow dot, and the decision and its Decide Button show once that tab is pressed

#### Scenario: Options and whys
- **WHEN** T-5 has options `keep` (why `it works`) and `drop` (no why)
- **THEN** the tab shows `T-5 <title>`, `Recommended: keep · it works`, `Or: drop` and `Decide T-5`

#### Scenario: A decision with no options
- **WHEN** a decision has none in the status
- **THEN** its id and title still show

### Requirement: Desk pane Work tab
The Work tab SHALL hold what is in progress, in this order: Open branches, Agents, Pull requests, Overlaps, Running sessions. An open PR SHALL be said on the Pull requests card (with `a person merges`) and not again on its branch row.
Open branches SHALL hold one row for each branch and each claim with no branch, a claim's row as `<slug> · <from> · claimed <age>`, then ` · last post <age>` when known, and under a row the active todos on that slug.
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
- **THEN** the extension refuses it and names what to update; the pane cannot meet this, because its CLI ships with it

## MODIFIED Requirements

### Requirement: Desk pane rows
The pane SHALL show these rows, each a label and a value, and SHALL leave out any row whose value is unknown:

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

### Requirement: Decide button
A `Decide <id>` Button, in the band or the pane's Decisions tab, SHALL be drawn as the primary action, and
the band's count SHALL be yellow. A press SHALL run `desk decide` from the plugin's own code, not through the
engine's command chain, and SHALL walk the waiting decisions as the requirements below say.

#### Scenario: Only the plugin answers
- **WHEN** the user presses `Decide T-5` in the band or the pane and no other hook answers `/decide`
- **THEN** `desk decide` runs

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

### Requirement: Desk pane merge policy
The Desk pane SHALL show the PR state from `desk status --json` for a `review` branch, on the Pull requests card when `prs` lists the branch and on the row otherwise, and `review` on that repo's Roots line. A `direct` repo's rows SHALL not change, and verdict colours SHALL not change.

#### Scenario: Waiting for a person
- **WHEN** a `review` branch has an open PR and a `MERGE` verdict
- **THEN** the PR shows as open, on the Pull requests card when `prs` lists the branch and on the row otherwise, and the verdict is not coloured as a failure

#### Scenario: Merged on the server
- **WHEN** a `review` branch's PR is merged
- **THEN** the row names `desk wt merge <slug>`

## REMOVED Requirements

### Requirement: Desk pane decisions
**Reason**: Decisions move out from above the tabs to their own tab, marked while closed.
**Migration**: See Desk pane Decisions tab.

### Requirement: Desk pane tabs
**Reason**: The tabs Work, Branches and Sessions become Decisions, Work and Todos.
**Migration**: See Desk pane three tabs.

### Requirement: Desk pane Work and Sessions tab sections
**Reason**: The Sessions tab goes; its sections move to the Work tab and the rows.
**Migration**: See Desk pane Work tab and Desk pane rows.

### Requirement: Desk pane Branches tab sections
**Reason**: The Branches tab goes; its sections move to the Work tab.
**Migration**: See Desk pane Work tab.
