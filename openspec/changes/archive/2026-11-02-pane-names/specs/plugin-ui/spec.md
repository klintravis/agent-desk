## ADDED Requirements

### Requirement: Desk pane headline
Above the tabs the pane SHALL show one line counting the open branches that are ready or wait on someone, in the colour of the worst of them.

#### Scenario: Only what is not zero
- **WHEN** one branch is ready, one needs review and one needs fixes
- **THEN** the line reads `1 ready to merge · 1 needs review · 1 fixes needed` in red

#### Scenario: Nothing to count
- **WHEN** every open branch is in progress, or there are none
- **THEN** no line is drawn

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

#### Scenario: Unknown row left out
- **WHEN** a row's value is unknown
- **THEN** the pane leaves that row out

### Requirement: Desk pane decisions
Below the rows, when a decision waits, the pane SHALL show each as `<id> <title>` and a `Decide <id>` Button for
the first, outside any tab. The rows and the decisions are bordered cards.

#### Scenario: Decisions outside the tabs
- **WHEN** a decision waits and the Sessions tab is open
- **THEN** the decision and its Decide Button are shown

### Requirement: Desk pane tabs
Below the rows, any decisions and the headline, the pane SHALL show three tab Buttons, Work (the default), Branches and Sessions, each with its count,
and only the open tab's sections, each a bordered card with a heading over its lines, `none` when empty
and `unavailable` when the status has no value for it.

#### Scenario: A closed tab
- **WHEN** the Work tab is open
- **THEN** no branch verdict is drawn until Branches is pressed

#### Scenario: The Sessions label
- **WHEN** three sessions run
- **THEN** the third tab reads `Sessions 3`

### Requirement: Desk pane Work and Desk tab sections
The Work and Sessions tabs SHALL hold these sections:

| Tab | Sections |
|---|---|
| Work | Active todos (one row each: id and summary or title, see Active todo row; `state:` and `next:` when set); Agents, each running or pending agent as `<type> · <description> · <age>` |
| Sessions | Running sessions; Roots, one dim row each; Tokens today |

#### Scenario: Agents
- **WHEN** two agents run
- **THEN** the Work tab's Agents lists two lines

#### Scenario: A running session
- **WHEN** a session has a title, a claimed worktree and two agents
- **THEN** its row shows the title, then a dim `wt:<slug> · <id> · 2 agents`, then one line per agent as `<type> · <about>`, each cut at the edge

#### Scenario: A session with no title
- **WHEN** a session has no title
- **THEN** its slug names the row, or its id when it has no slug, and the footnote does not repeat that id

#### Scenario: This session
- **WHEN** a session's id begins this session's id
- **THEN** its row is marked `this session`

### Requirement: Desk pane Branches tab sections
The Branches tab SHALL hold these sections:

| Tab | Sections |
|---|---|
| Branches | Open branches, one row each, see the scenarios; Trees, only when a claim has no branch, as `<slug> · <from> · claimed <age>`, then ` · last post <age>` when known; Pull requests when known; Overlaps |

#### Scenario: Rows
- **WHEN** two agents run, one worktree with no branch is claimed and nothing waits
- **THEN** the Work tab's Agents lists two lines, the Branches tab's Trees lists one, and no decision or Decide Button is shown

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

### Requirement: Desk pane CI and verdict colours
A branch's state word SHALL be green only when both its CI and its verdict cover the branch head and it is not behind
(a CI text ending in `success`; a verdict `MERGE @<sha>` where `<sha>` is 7 to 40 characters of the head, the merge gate's test), red for a
failed run or a `FIXES` or `DO NOT MERGE` verdict on the head, and orange otherwise.

#### Scenario: A pass on an older commit
- **WHEN** a branch's CI reads `success (not the head)` or its verdict names another commit
- **THEN** its state word is orange, not green

#### Scenario: Behind the default branch
- **WHEN** CI and verdict cover the head but the branch is behind
- **THEN** its state word is `rebase`, in orange
