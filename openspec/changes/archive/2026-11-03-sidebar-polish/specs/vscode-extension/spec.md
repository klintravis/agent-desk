## MODIFIED Requirements

### Requirement: Status view
The view SHALL draw from the fields of one `desk status --json` run, and SHALL refuse a status whose `v` is not 2, naming both versions. Its sections SHALL be, in order, `Owner decisions`, `Work`, `Running sessions` and `Overlaps`, each with its count; an empty section SHALL be hidden, and a status with nothing in it SHALL show one row, `Nothing active`. `Work` SHALL hold one row per piece of work, the active todos, the branch and the claim of a slug joined into one row (several todos on a slug are its children; a todo without a slug, a branch or a claim alone still get a row). A row SHALL show the todo's summary, else its title, else the slug, with only the short CI, the verdict, `behind`, the PR, `claimed` and `N todos` as description, and the rest (id, title, state, next, head, holder) in the tooltip. A row's icon colour SHALL be green when CI succeeded or was skipped on the head (or the repo has no CI info, `CI -`) and the verdict is `MERGE` for that head and the branch is not behind; red when CI failed (`neutral` is not a pass) or any other verdict (`FIXES NEEDED`, `DO NOT MERGE`, `MERGE AFTER FIXES`) covers the head; yellow when CI is running, or CI passed but there is no `MERGE` verdict for the head or the branch is behind; else blue. A verdict for an older head SHALL NOT count. A session row SHALL show its title, else its id, and its agent count, with its agents as children; when the status holds no sessions list (`null`) the section SHALL read `Running sessions (unavailable)`, and when it holds no overlaps list (`null`, the check failed) `Overlaps (unavailable)`. Text from the desk SHALL show as plain text. The view's badge SHALL count the waiting decisions.

#### Scenario: A decision waits
- **WHEN** the status holds a decision T-5
- **THEN** `Owner decisions (1)` lists `T-5 <title>`, the badge says 1, and pressing the row starts the Decide walk

#### Scenario: One row per piece of work
- **WHEN** a slug has a todo, a branch and a claim
- **THEN** `Work (1)` holds one row, not three

#### Scenario: Ready branch
- **WHEN** CI succeeded on the head and the verdict is `MERGE @<head>`
- **THEN** the row's icon is green and its description reads `CI success · verdict MERGE`

#### Scenario: Branch row
- **WHEN** a branch is 2 commits behind and has a verdict and CI text
- **THEN** its row's description shows the short CI, the verdict and `behind <base> by 2`

#### Scenario: Running session
- **WHEN** the status holds a session with a title and 2 agents, and another with no title
- **THEN** `Running sessions (2)` lists the title with `2 agents`, and the untitled one by its id

#### Scenario: Sessions unreadable
- **WHEN** the status has `sessions` null
- **THEN** the section reads `Running sessions (unavailable)`

#### Scenario: Unknown status version
- **WHEN** the desk's kit prints `v` 3
- **THEN** the view says the versions differ and draws nothing from that run
