## MODIFIED Requirements

### Requirement: Status view
The view SHALL draw from the fields of one `desk status --json` run, and SHALL refuse a status whose `v` is not 2, naming both versions. Its sections SHALL be, in order, `Owner decisions`, `Active todos`, `Running sessions`, `Branches`, `Claims` and `Overlaps`, each with its count. A session row SHALL show its title, else its id, and its agents as tooltip lines. Text from the desk SHALL show as plain text, and `ci` and `verdict` as the CLI gives them. The view's badge SHALL count the waiting decisions.

#### Scenario: Running session
- **WHEN** the status holds a session with a title and 2 agents, and another with no title
- **THEN** `Running sessions (2)` lists the title with the id and `2 agents`, and the untitled one by its id
