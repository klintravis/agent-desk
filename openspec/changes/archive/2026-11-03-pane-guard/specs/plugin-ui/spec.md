## MODIFIED Requirements

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
