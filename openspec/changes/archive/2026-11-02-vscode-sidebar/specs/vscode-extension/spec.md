## ADDED Requirements

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

### Requirement: Status view
The view SHALL draw from the fields of one `desk status --json` run, and SHALL refuse a status whose `v` is not 2, naming both versions. Its sections SHALL be, in order, `Owner decisions`, `Active todos`, `Branches`, `Claims` and `Overlaps`, each with its count. Text from the desk SHALL show as plain text, and `ci` and `verdict` as the CLI gives them. The view's badge SHALL count the waiting decisions.

#### Scenario: A decision waits
- **WHEN** the status holds a decision T-5
- **THEN** `Owner decisions (1)` lists `T-5 <title>`, the badge says 1, and pressing the row starts the Decide walk

#### Scenario: Branch row
- **WHEN** a branch is 2 commits behind and has a verdict and CI text
- **THEN** its row shows the short head, the CI text, the verdict and `behind <base> by 2`

#### Scenario: Unknown status version
- **WHEN** the desk's kit prints `v` 3
- **THEN** the view says the versions differ and draws nothing from that run

### Requirement: Refresh
The view SHALL run the status at start, every 60 seconds and on the Refresh command, one run at a time; a request during a run SHALL cause one more run after it. Until the first result it SHALL say `Loading desk status…`. A failing run SHALL show its error and keep the last tree.

#### Scenario: Failing run
- **WHEN** a run exits non-zero
- **THEN** the view's message holds its stderr and the sections stay as they were

#### Scenario: The run after a ruling
- **WHEN** a ruling is recorded while a status run is in flight
- **THEN** another run follows, so the decision leaves the view without waiting a minute

### Requirement: Decide walk
The Decide command SHALL run `desk decide` and parse the printed decision the way `hooks/pane.tsx` does: the id is the printed one, never the row's, so a ruling lands on the question the owner read. It SHALL offer the printed options and `Other…` in a quick pick, or an input box when there are no options, and SHALL record the answer with `desk decide <printed id> <ruling>`, then go on with the decision that record printed. One walk SHALL run at a time.

#### Scenario: Pick and record
- **WHEN** T-5 is printed with `Recommended: (a) keep` and `Or: (b) drop`, and the owner picks `(b) drop`
- **THEN** `desk decide T-5 "(b) drop"` runs, the record's `from` is `owner`, and the view refreshes

#### Scenario: Typed ruling
- **WHEN** the owner picks `Other…` and types `neither, wait`
- **THEN** `desk decide T-5 "neither, wait"` runs

#### Scenario: Walks on
- **WHEN** the record prints T-6 and the owner rules it too, and `No owner decisions waiting.` prints
- **THEN** T-6 was asked and the walk ends with that text as a message

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
