## ADDED Requirements

### Requirement: Approach by kind
The kit SHALL ship approach skills `fix` and `refactor`, each ending in a `## Done when` list. The `orchestrate` skill SHALL map each change kind (fix, feature, refactor, perf, docs) to an approach, a task id, what the validator proves and whether the structure pass runs, and SHALL name the approach in every `implementer` and `reviewer` brief. The `implementer` SHALL follow the named approach, and the `reviewer` SHALL report each unmet `Done when` item as a finding. Only `refactor` SHALL replace Ponytail's smallest-diff and keep-the-structure rules, for its run only; Ponytail's never-cut list SHALL hold in every approach.

#### Scenario: A bug fix
- **WHEN** a todo of kind fix is delegated
- **THEN** the brief names the `fix` approach and the implementer commits a test that fails before the fix
- **AND** a fix with no failing-before evidence is a reviewer finding

#### Scenario: An intentional refactor
- **WHEN** a todo of kind refactor is delegated
- **THEN** a `structure-reviewer` in plan mode returns the target shape for the area's paths first
- **AND** the implementer follows `refactor`, keeping the pinned tests unedited and deleting the old path in the same branch

### Requirement: Validator
The kit SHALL ship a `validate` skill and an agent `validator`, model `sonnet`, effort `medium`, tools `Read`, `Grep`, `Glob`, `Bash`, `Write` and `Skill`, that reruns a branch's acceptance claims (`accept: <claim> | <command> | <expected>` todo notes and new spec scenarios) on the head, and on the base for fix, refactor and perf, and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE per claim. It SHALL change nothing in the worktree, SHALL remove any base worktree it adds, and SHALL post no board verdict. The `orchestrate` skill SHALL run it beside the `reviewer` for every kind but docs, treat NOT VERIFIED as a must-fix finding, and merge only when every claim is VERIFIED.

#### Scenario: A fix that did not fix
- **WHEN** the repro still fails on the head
- **THEN** the claim is NOT VERIFIED and the orchestrator sends it to the fix round with the reviewer's findings
