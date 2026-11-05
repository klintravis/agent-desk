## ADDED Requirements

### Requirement: Approach by kind
The kit SHALL ship approach skills `fix` and `refactor`, each ending in a `## Done when` list. The `orchestrate` skill SHALL map each change kind (fix, feature, refactor, perf, docs) to an approach, a task id, whether the validator runs and whether the structure pass runs, and SHALL name the approach in every `implementer` and `reviewer` brief. The `implementer` SHALL follow the named approach; the `reviewer` SHALL judge the diff's scope against it (a fix that changes more than the fault, a refactor that changes behaviour). Only `refactor` SHALL replace Ponytail's smallest-diff and keep-the-structure rules, for its run only, and only in its own skill text; Ponytail's never-cut list SHALL hold in every approach. A `debug` run SHALL do the `fix` skill's steps 1-4 and hand the repro, test and root cause to the implementer, which starts at step 5.

#### Scenario: A bug with an unknown cause
- **WHEN** a todo of kind fix has no known cause
- **THEN** a `debug` run commits the failing test and reports the root cause
- **AND** the `fix-known` implementer starts at the `fix` skill's step 5

#### Scenario: An intentional refactor across several files
- **WHEN** a todo of kind refactor spans several files
- **THEN** a `structure-reviewer` in plan mode returns the target shape for the area's paths first
- **AND** the implementer follows `refactor`, and the validator shows no pinned test edited after its pinning commit
### Requirement: Validator
The kit SHALL ship a `validate` skill and an agent `validator`, model `sonnet`, effort `medium`, tools `Read`, `Grep`, `Glob`, `Bash`, `Write` and `Skill`, that reruns a branch's acceptance claims (`accept: <claim> | <command> | <expected>` todo notes and new spec scenarios) in a detached copy of the head, and of the base for fix, refactor and perf, and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE per claim. The `validate` skill SHALL be the one list of what each kind proves. The validator SHALL change nothing in the worktree, SHALL run nothing in it, SHALL remove every copy it adds, and SHALL post no board verdict. The `orchestrate` skill SHALL run it beside the `reviewer` for every kind but docs, and for a feature only when a claim is not run by CI; it SHALL put every reviewer finding, NOT VERIFIED claim, INCONCLUSIVE claim not settled or waived by the owner, and structure blocker on one must-fix list, and when that list is not empty SHALL post `FIXES NEEDED` on the board after the reviewer's verdict, so `desk wt merge` refuses the head until the `verifier` posts `MERGE`.

#### Scenario: A fix that did not fix
- **WHEN** the repro still fails on the head and the reviewer posted `MERGE`
- **THEN** the orchestrator posts `FIXES NEEDED` for that head and `desk wt merge` refuses it
