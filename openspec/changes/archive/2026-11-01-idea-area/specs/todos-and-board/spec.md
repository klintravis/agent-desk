## MODIFIED Requirements

### Requirement: todo split
`todo split T-n "<child>" ...` SHALL add one open child per title with `parent` T-n, inheriting the
parent's area, priority and change, and SHALL print the parent's line and the new children's lines.

#### Scenario: Children inherit
- **WHEN** `T-4` has area `app` and priority 3 and is split into two titles
- **THEN** two open todos with parent `T-4`, area `app` and priority 3 are added

### Requirement: todo next
`todo next [--area a]` SHALL pick, among `open` todos (not active or blocked) that have no open child
(`open`, `active` or `blocked`; an `idea` child counts only when the todo is itself an idea), the lowest
`prio` (missing = 50) and then the lowest number, and print its line and `why`, or `nothing open`. Without `--area`, `owner`, `watch` and `idea` todos SHALL be excluded;
with `--area owner`, `--area watch` or `--area idea` only those are returned.

#### Scenario: Child before parent
- **WHEN** `T-1` (prio 5) has an open child `T-2` (prio 1)
- **THEN** `todo next` returns `T-2`

#### Scenario: Parent waits for an active child
- **WHEN** the only open parent has an active child
- **THEN** `todo next` prints `nothing open`

#### Scenario: Owner decisions are not work
- **WHEN** an open todo has area `owner` and `todo next` runs without `--area`
- **THEN** it is not returned

#### Scenario: Watch items are not work
- **WHEN** an open todo has area `watch` and `todo next` runs without `--area`
- **THEN** it is not returned

#### Scenario: Ideas are not work
- **WHEN** an open todo has area `idea` and `todo next` runs without `--area`
- **THEN** it is not returned, and `todo next --area idea` returns it

#### Scenario: An idea child does not hold back its parent
- **WHEN** an open repo todo has an open child with area `idea`
- **THEN** `todo next` returns the parent

### Requirement: todo list and show
`todo list [--area a] [--all]` SHALL print the todo tree (children under parents, ordered by priority
then number), showing only `open`, `active` and `blocked` unless `--all`. Todos with area `idea` SHALL
be shown only with `--area idea` or `--all`. `todo show T-n` SHALL print the
folded todo as JSON. The legacy area `repo` SHALL count as the first repo. `todo md` SHALL no longer
exist.

#### Scenario: Legacy area
- **WHEN** a todo has area `repo` and `app` is the first repo
- **THEN** it appears in `todo list --area app`

#### Scenario: Watch area listed
- **WHEN** an open todo has area `watch`
- **THEN** `todo list` and `todo list --area watch` show it

#### Scenario: Ideas hidden from the plain list
- **WHEN** an open todo has area `idea`
- **THEN** `todo list` does not show it, and `todo list --area idea` and `todo list --all` do

#### Scenario: A child whose parent is not shown
- **WHEN** an open todo has a parent the current filter does not show
- **THEN** it is printed at the top level, once

#### Scenario: md removed
- **WHEN** `desk todo md` runs
- **THEN** it exits 1 as an unknown subcommand and writes nothing
