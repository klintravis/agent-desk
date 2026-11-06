## MODIFIED Requirements

### Requirement: Stack lenses
The kit SHALL ship a `stack-lens` skill whose table lists each lens, with two files under `lenses/`: `<lens>.build.md` and `<lens>.review.md`. The `implementer` SHALL follow the build file and the `reviewer` SHALL check the review file of the lenses its brief names or its files match (one only, for a one-lens brief), reading no other. `orchestrate` SHALL name in each `implementer` and `reviewer` brief what `desk lenses <slug>` prints, plus lenses no rule catches.

#### Scenario: TypeScript change with a retry loop
- **WHEN** a brief names the lenses `typescript` and `state`
- **THEN** an implementer reads `typescript.build.md` and `state.build.md` and no other lens file

## ADDED Requirements

### Requirement: Lens reviewers
When `desk lenses` prints two or more lenses, the `orchestrate` review step SHALL start, beside the main `reviewer` (which gets every lens), one more fresh `reviewer` per printed lens other than `typescript`, in the same message, at the `review` task's model and effort, briefed with that lens's review file only and to report only findings in that lens. Each SHALL post its own verdict, and its findings SHALL join the one must-fix list.

#### Scenario: Lens reviewers
- **WHEN** `desk lenses` prints `typescript`, `security` and `testing` for a branch at review
- **THEN** three fresh reviewers start in one message: the main one with all three lenses, one with `security.review.md` only and one with `testing.review.md` only
- **AND** each posts a verdict on the same head, and a finding from any of them goes on the must-fix list

#### Scenario: Small change
- **WHEN** `desk lenses` prints only `typescript`, or nothing
- **THEN** one reviewer runs
