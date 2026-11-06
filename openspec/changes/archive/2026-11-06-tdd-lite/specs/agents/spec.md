## MODIFIED Requirements

### Requirement: Approach by kind
The kit SHALL ship approach skills `fix` and `refactor`, each ending in a `## Done when` list. The `orchestrate` skill SHALL map each change kind (fix, feature, refactor, perf, docs) to an approach, a task id, whether the validator runs and whether the structure pass runs, and SHALL name the approach in every `implementer` and `reviewer` brief.

#### Scenario: Further rules
The `implementer` SHALL follow the named approach; the `reviewer` SHALL judge the diff's scope against it (a fix that changes more than the fault, a refactor that changes behaviour). Only `refactor` SHALL replace Ponytail's smallest-diff and keep-the-structure rules, for its run only, and only in its own skill text; Ponytail's never-cut list SHALL hold in every approach. A `debug` run SHALL do the `fix` skill's steps 1-4 and hand the repro, test and root cause to the implementer, which starts at step 5.

#### Scenario: A bug with an unknown cause
- **WHEN** a todo of kind fix has no known cause
- **THEN** a `debug` run commits the failing test and reports the root cause
- **AND** the `fix-known` implementer starts at the `fix` skill's step 5

#### Scenario: A feature is built test-first
- **WHEN** a todo of kind feature is implemented
- **THEN** the `implementer` commits the failing test alone as `test: <behaviour>` with the body `red: <cmd> | exit <n>` before the first non-test commit, or `red: n/a <why>` when no cheap local test exists, a commit hook runs the suite or the test cannot fail on an assertion before a new module exists (`red: n/a new module`)
- **AND** the validator finds the test commit by `git log --grep '^red:' origin/<default>..HEAD` (none is NOT VERIFIED), runs the `accept:` command on it expecting a non-zero exit on the behaviour's assertion (not a missing module), then on the head expecting 0, and `git log --name-only --reverse origin/<default>..HEAD` shows the test commit, touching only tests, before the first non-test commit
- **AND** with a `red: n/a` receipt the validator skips the test-commit run and the order check, judges the why and still runs the head

#### Scenario: An intentional refactor across several files
- **WHEN** a todo of kind refactor spans several files
- **THEN** a `structure-reviewer` in plan mode returns the target shape for the area's paths first
- **AND** the implementer follows `refactor`, and the validator shows no pinned test edited after its pinning commit

### Requirement: Validator
The kit SHALL ship a `validate` skill and an agent `validator`, model `sonnet`, effort `medium`, tools `Read`, `Grep`, `Glob`, `Bash`, `Write` and `Skill`, that reruns a branch's acceptance claims (`accept: <claim> | <command> | <expected>` todo notes and new spec scenarios) in a detached copy of the head, and of the base for fix, refactor and perf (the test commit for a feature), and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE per claim.

#### Scenario: Further rules
The `validate` skill SHALL be the one list of what each kind proves. The validator SHALL change nothing in the worktree, SHALL run nothing in it, SHALL remove every copy it adds, and SHALL post `FIXES NEEDED @<head>` when any claim is not VERIFIED. The `orchestrate` skill SHALL run it beside the `reviewer` for every kind but docs, and SHALL keep one must-fix list per branch (reviewer findings, failed or unsettled claims, structure blockers). The merge gate SHALL refuse a head that any `FIXES NEEDED`, `DO NOT MERGE` or `MERGE AFTER FIXES` verdict names, whatever verdict comes after it, unless a later verdict is `MERGE @<head> overrides: <why>` (never for `DO NOT MERGE`). `todo start` and `desk stream --todo` SHALL refuse a todo whose `kind` is other than `docs` and that has no `accept:` note; `--kind` SHALL be one of `fix`, `feature`, `refactor`, `perf`, `docs`.

#### Scenario: A fix that did not fix
- **WHEN** the validator posts `FIXES NEEDED @<head>` and the reviewer later posts `MERGE @<head>`
- **THEN** `desk wt merge` refuses the head

#### Scenario: A claim settled by a rerun
- **WHEN** `MERGE @<head> overrides: rerun verified` follows it
- **THEN** the earlier `FIXES NEEDED @<head>` no longer blocks

#### Scenario: A typed todo without a claim
- **WHEN** `desk todo start T-1` runs on a todo of kind `fix` with no `accept:` note
- **THEN** it exits 1 and the todo stays open
