# agents Specification

## Purpose
The kit's delegation agents in `agents/` and the skills they load, as far as their scope is a promise: `scribe`, `structure-reviewer`, `stack-lens`, the `fix` and `refactor` approaches, `validator`.

## Requirements

### Requirement: Scribe writes bookkeeping docs from a diff
The kit SHALL ship an agent `scribe` with model `haiku` and effort `low`. It SHALL write a branch's CHANGELOG entry, `openspec/inventory.md` rows and rows of the README's command table from the branch's diff, and SHALL edit no other file or README text.

#### Scenario: New command on a branch
- **WHEN** a branch's diff adds a command and `scribe` runs on it
- **THEN** it adds the CHANGELOG entry, the inventory row and the command-table row
- **AND** `git diff --name-only` for its edits lists only those three files

### Requirement: Scribe hands back explanatory prose
`scribe` SHALL leave prose that describes behaviour unwritten and SHALL list each such item in its report, with the file and section it belongs in.

#### Scenario: Change needs a README paragraph
- **WHEN** a branch's change needs a paragraph explaining new behaviour
- **THEN** `scribe` does not write it and its report lists it under Handed back

### Requirement: Scribe stays out of other agents' work
`scribe` SHALL NOT archive specs, review or verify. The `orchestrate` skill SHALL route these docs to `scribe` in a row that does not overlap its docs row for `implementer`, and `archiver` SHALL stay on `sonnet`.

#### Scenario: Picking an agent for docs
- **WHEN** the orchestrator looks up a README paragraph and a CHANGELOG entry in the `orchestrate` table
- **THEN** the paragraph matches the `implementer` row and the entry matches the `scribe` row

### Requirement: Scribe reaches Copilot
`desk sync` SHALL write `scribe` to `.github/agents/scribe.agent.md` with the other kit agents, with `reasoning-effort: "low"` and its tools mapped, and without a `model` field.

#### Scenario: Sync with the copilot harness
- **WHEN** `desk sync` runs with the `copilot` harness
- **THEN** `.github/agents/scribe.agent.md` exists with that frontmatter

### Requirement: One implementer run per task group
The `orchestrate` skill SHALL tell the orchestrator to start one `implementer` run per code task group, in order, in the same worktree, when a change is expected to change over about 150 lines, and each run SHALL commit before the next starts. A single group SHALL be split first, and a group that cannot pass the check alone SHALL join its neighbour. `scribe` SHALL run after the last run's commit.

#### Scenario: Large change with three code groups
- **WHEN** a change expected to pass 150 lines has three code task groups
- **THEN** the orchestrator runs three `implementer` runs in sequence in one worktree, each ending in a commit

#### Scenario: Large change with one group
- **WHEN** a change expected to pass 150 lines has one task group
- **THEN** the orchestrator splits it into groups before the first run

#### Scenario: Small change with several groups
- **WHEN** a change expected to stay under 150 lines has several task groups
- **THEN** one `implementer` run does them all

### Requirement: Structure reviewer
The kit SHALL ship an agent `structure-reviewer`, model `opus`, effort `medium`, with the tools `Read`, `Grep`, `Glob`, `Bash` and `Skill` only, that follows the vendored `thermo-nuclear-code-quality-review` skill on a worktree branch's diff, or, given paths, returns a refactor's target shape. It SHALL change nothing and SHALL post no board verdict. The `orchestrate` skill's Approach by kind section SHALL be the one place that says when it runs: once per branch, beside the `reviewer`, for a refactor or a change over about 300 changed lines outside test files or pushing a file past 1000 lines. Its blockers SHALL join the must-fix list (see Validator).

#### Scenario: Large change
- **WHEN** a feature of about 400 changed lines outside tests reaches review
- **THEN** the orchestrator starts `reviewer` and `structure-reviewer` in the same message on the same head
- **AND** a fix round after it goes to the `verifier`, not to a second structure pass

#### Scenario: Small change
- **WHEN** a feature of 40 lines that grows no file past 1000 lines reaches review
- **THEN** no structure pass runs

### Requirement: Stack lenses
The kit SHALL ship a `stack-lens` skill whose table lists each lens, with two files under `lenses/`: `<lens>.build.md` and `<lens>.review.md`. The `implementer` SHALL follow the build file and the `reviewer` SHALL check the review file of the lenses its brief names or its files match, reading no other lens file. The `orchestrate` skill SHALL name the lenses in every `implementer` and `reviewer` brief.

#### Scenario: TypeScript change with a retry loop
- **WHEN** a brief names the lenses `typescript` and `state`
- **THEN** an implementer reads `typescript.build.md` and `state.build.md` and no other lens file

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
The kit SHALL ship a `validate` skill and an agent `validator`, model `sonnet`, effort `medium`, tools `Read`, `Grep`, `Glob`, `Bash`, `Write` and `Skill`, that reruns a branch's acceptance claims (`accept: <claim> | <command> | <expected>` todo notes and new spec scenarios) in a detached copy of the head, and of the base for fix, refactor and perf, and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE per claim. The `validate` skill SHALL be the one list of what each kind proves. The validator SHALL change nothing in the worktree, SHALL run nothing in it, SHALL remove every copy it adds, and SHALL post `FIXES NEEDED @<head>` when any claim is not VERIFIED. The `orchestrate` skill SHALL run it beside the `reviewer` for every kind but docs, and for a feature only when a claim is not run by CI, and SHALL keep one must-fix list per branch (reviewer findings, failed or unsettled claims, structure blockers). The merge gate SHALL refuse a head that any `FIXES NEEDED`, `DO NOT MERGE` or `MERGE AFTER FIXES` verdict names, whatever verdict comes after it, unless a later verdict is `MERGE @<head> overrides: <why>` (never for `DO NOT MERGE`). `todo start` and `desk stream --todo` SHALL refuse a todo whose `kind` is other than `docs` and that has no `accept:` note; `--kind` SHALL be one of `fix`, `feature`, `refactor`, `perf`, `docs`.

#### Scenario: A fix that did not fix
- **WHEN** the validator posts `FIXES NEEDED @<head>` and the reviewer later posts `MERGE @<head>`
- **THEN** `desk wt merge` refuses the head

#### Scenario: A claim settled by a rerun
- **WHEN** `MERGE @<head> overrides: rerun verified` follows it
- **THEN** the earlier `FIXES NEEDED @<head>` no longer blocks

#### Scenario: A typed todo without a claim
- **WHEN** `desk todo start T-1` runs on a todo of kind `fix` with no `accept:` note
- **THEN** it exits 1 and the todo stays open
