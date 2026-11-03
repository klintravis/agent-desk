## ADDED Requirements

### Requirement: Three views
The sidebar SHALL hold three collapsible views, Decisions, Work and Todos, in that order, drawn from the fields of one `desk status --json` run. It SHALL refuse a status whose `v` is not 2, naming both versions, or in which any branch has no `state` or `todos` is missing, saying to update whichever is older. Text from the desk SHALL show as plain text. Gaps with the Desk pane are stated in the `plugin-ui` requirement Panels in both surfaces.

#### Scenario: Same panels as the pane
- **WHEN** a desk is open
- **THEN** the sidebar shows Decisions, Work and Todos, each with its own collapse

#### Scenario: Unknown status version
- **WHEN** the desk's kit prints `v` 3
- **THEN** every view says the versions differ and draws nothing from that run

#### Scenario: Branch without state
- **WHEN** the status holds a branch with no `state`
- **THEN** every view says to update whichever is older and draws nothing from that run

#### Scenario: Status without todos
- **WHEN** the desk's older kit prints a status with no `todos`
- **THEN** every view says to update whichever is older and draws nothing from that run

### Requirement: Decisions view
The Decisions view SHALL show each waiting decision as `<id> <title>`, its options as children (first marked `Recommended`, each with its why), and `No decisions waiting` when none waits. The view's badge SHALL count the waiting decisions, and the Decide action SHALL be in this view.

#### Scenario: A decision waits
- **WHEN** the status holds a decision T-5 with options
- **THEN** the view lists `T-5 <title>` with its options, the badge says 1, and pressing the row starts the Decide walk

#### Scenario: Nothing waits
- **WHEN** no decision waits
- **THEN** the view has one row, `No decisions waiting`

### Requirement: Work view
The Work view SHALL hold one row per branch or claim, joined with the active todos on that slug (several are its children), most urgent branch first (as the pane's Open branches card), then `Pull requests`, `Overlaps` and `Running sessions` with their counts, each hidden when empty. A pull request row shows its review state, comments, unresolved and new-since-head counts, coloured as the pane's card, and `a person merges` when its branch's PR is open; the branch row then does not repeat the open PR. A row SHALL show the todo's summary, else its title, else the slug, with only the branch state word, `behind`, the PR, `claimed` and `N todos` as description, and the rest in the tooltip. With nothing in it the view SHALL show `Nothing in progress`.

#### Scenario: One row per piece of work
- **WHEN** a slug has a todo, a branch and a claim
- **THEN** the view holds one row for it, not three

#### Scenario: Ready branch
- **WHEN** the CLI reports `state: ready`
- **THEN** the row's icon is green and its description starts with `ready`

#### Scenario: Row colours
- **WHEN** a branch's `state` is `CI failed` or `fixes needed`; or `CI running`, `needs review` or `rebase`; or any other word
- **THEN** its icon is red; or yellow; or blue, and the extension parses neither the CI text nor the verdict

#### Scenario: Branch row
- **WHEN** a branch is 2 commits behind
- **THEN** its row's description reads `rebase · behind <base> by 2`

#### Scenario: Running session
- **WHEN** the status holds a session with a title and 2 agents, and another with no title
- **THEN** `Running sessions (2)` lists the title with `2 agents`, its agents as children, and the untitled one by its id

#### Scenario: Sessions unreadable
- **WHEN** the status has `sessions` null
- **THEN** the section reads `Running sessions (unavailable)`

#### Scenario: Overlaps unreadable
- **WHEN** the status has `overlaps` null
- **THEN** the section reads `Overlaps (unavailable)`

#### Scenario: A todo that is not on a branch or claim
- **WHEN** an active todo has no open branch or claim on its slug
- **THEN** it is in the Todos view and not here

### Requirement: Todos view
The Todos view SHALL list the status's `todos` in the order given, each row the summary, else the title, with `<id>`, the status unless it is `open`, then `wt:<slug>`, else the owner, else the area, as description (the pane's label), `state` and `next` in the tooltip, and `No open todos` when empty. It SHALL have no cap.

#### Scenario: Open todos
- **WHEN** an active todo is on a branch and another is open
- **THEN** only the open one is here, and the active one is in the Work view

#### Scenario: Nothing open
- **WHEN** `todos` is empty
- **THEN** the view has one row, `No open todos`

## MODIFIED Requirements

### Requirement: Refresh
The views SHALL run the status at start, every 60 seconds and on the Refresh command, one run at a time; a request during a run SHALL cause one more run after it. Until the first result they SHALL say `Loading desk status…`. A failing run SHALL show its error and keep the last rows.

#### Scenario: Failing run
- **WHEN** a run exits non-zero
- **THEN** each view's message holds its stderr and its rows stay as they were

#### Scenario: The run after a ruling
- **WHEN** a ruling is recorded while a status run is in flight
- **THEN** another run follows, so the decision leaves the view without waiting a minute

## REMOVED Requirements

### Requirement: Status view
**Reason**: The one view with sections becomes three views.
**Migration**: See Three views, Decisions view, Work view and Todos view.
