# vscode-extension Specification

## Purpose
A VS Code extension in `vscode/` that shows the desk's status in a sidebar and runs its decisions through the desk CLI.

## Requirements

### Requirement: Packaging
The extension SHALL live in `vscode/` with the id `klintravis.agent-desk` and display name `Agent Desk`, carry the version in the root `package.json`, and have no `dependencies`. The root `package.json` `files` SHALL NOT list `vscode`.

#### Scenario: One version
- **WHEN** `vscode/package.json` carries a version other than the root `package.json`
- **THEN** `npm test` fails

#### Scenario: Release bump
- **WHEN** `scripts/release.mjs bump` runs
- **THEN** it writes the new version to `vscode/package.json`, and refuses when that file disagrees with the root `package.json`

#### Scenario: Not in the npm package
- **WHEN** a desk installs agent-desk
- **THEN** no file of `vscode/` is installed

### Requirement: Finding the desk
The extension SHALL use the first workspace root that holds `desk.config.json` and SHALL show its view only when there is one. It SHALL not run in an untrusted or virtual workspace, because it runs code from the workspace.

#### Scenario: Desk folder is a root
- **WHEN** the generated `.code-workspace` lists the desk first and repos after it
- **THEN** the desk is that first root

#### Scenario: No desk
- **WHEN** no workspace root holds `desk.config.json`
- **THEN** no view shows and no desk command runs

### Requirement: Running the desk CLI
The extension SHALL hold no desk logic and SHALL run `node <desk>/node_modules/agent-desk/bin/desk.mjs <args>` with the desk as cwd, `DESK_HOME` set to the desk whatever the environment held, each argument one argv element, no shell, and a 45 second timeout. `CLAUDE_CODE_SESSION_ID` SHALL NOT reach the child: what the extension records is the owner's, even in a VS Code started from a Claude session.

#### Scenario: Kit not installed
- **WHEN** `<desk>/node_modules/agent-desk/bin/desk.mjs` does not exist
- **THEN** the view says that file is missing and to run `npm install` in the desk folder

#### Scenario: No node
- **WHEN** `node` is not on PATH
- **THEN** the view says so

#### Scenario: Inherited DESK_HOME
- **WHEN** VS Code was started with `DESK_HOME` naming another desk
- **THEN** the CLI acts on the desk of the workspace root

### Requirement: Refresh
The views SHALL run the status at start, every 60 seconds and on the Refresh command, one run at a time; a request during a run SHALL cause one more run after it. Until the first result they SHALL say `Loading desk status…`. A failing run SHALL show its error and keep the last rows.

#### Scenario: Failing run
- **WHEN** a run exits non-zero
- **THEN** each view's message holds its stderr and its rows stay as they were

#### Scenario: The run after a ruling
- **WHEN** a ruling is recorded while a status run is in flight
- **THEN** another run follows, so the decision leaves the view without waiting a minute

### Requirement: Decide walk
The Decide command SHALL read `desk decide --json`, as `hooks/pane.tsx` does: the id is the one just read, never the row's, so a ruling lands on the question the owner read. It SHALL offer the options in a quick pick, each row's label the option's label, its detail the option's why, the first marked recommended in its description, and `Other…` last for a free-text ruling in an input box; a decision with no options goes straight to the input box. It SHALL record the answer with `desk decide <id> <ruling>` without a shell, then read the next decision. A choice SHALL record the label only. One walk SHALL run at a time.

#### Scenario: Pick and record
- **WHEN** T-5 has options `Keep: it works` and `Drop: less code`, and the owner picks `Drop`
- **THEN** the row showed `less code` as its detail, `desk decide T-5 "Drop"` runs, the record's `from` is `owner`, and the view refreshes

#### Scenario: Typed ruling
- **WHEN** the owner picks `Other…` and types `neither, wait`
- **THEN** `desk decide T-5 "neither, wait"` runs

#### Scenario: Walks on
- **WHEN** the owner rules T-5, T-6 waits and the owner rules it too, and none waits then
- **THEN** T-6 was asked and the walk ends with the message `No owner decisions waiting.`

#### Scenario: Closing the picker
- **WHEN** the owner closes the quick pick or the input box
- **THEN** nothing is recorded, the walk ends, and a message says nothing was recorded

### Requirement: No secret in a ruling
The Decide walk SHALL check each ruling with `hasSecret` of the desk's own kit before recording it. A ruling that holds a secret, or a check that cannot load, SHALL end the walk and record nothing.

#### Scenario: Secret typed
- **WHEN** the text typed under `Other…` holds a token
- **THEN** `decisions.jsonl` does not change, the todo stays open and an error says why

#### Scenario: Check missing
- **WHEN** the desk's kit has no `hooks/secretpatterns.mjs`
- **THEN** nothing is recorded and an error shows

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
