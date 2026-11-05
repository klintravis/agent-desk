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
The kit SHALL ship an agent `structure-reviewer`, model `opus`, effort `medium`, with the tools `Read`, `Grep`, `Glob`, `Bash` and `Skill` only, that follows the vendored `thermo-nuclear-code-quality-review` skill on a worktree branch's diff. It SHALL change nothing and SHALL post no board verdict. The `orchestrate` skill SHALL start it as task `review-structure` in parallel with the `reviewer` when a change passes about 300 lines, is a refactor, or pushes a file past 1000 lines, and SHALL merge its blockers into the reviewer's findings for one fix round.

#### Scenario: Large change
- **WHEN** a change of about 400 lines reaches review
- **THEN** the orchestrator starts `reviewer` and `structure-reviewer` in the same message on the same head
- **AND** only the reviewer posts a verdict, so `desk wt merge` gates on it as before

#### Scenario: Small change
- **WHEN** a change of 40 lines that grows no file past 1000 lines reaches review
- **THEN** only the `reviewer` runs

### Requirement: Stack lenses
The kit SHALL ship a `stack-lens` skill whose table maps each lens to one file under `lenses/`, each file with a `## Build` and a `## Review` section. The `implementer` SHALL follow the Build half and the `reviewer` SHALL check the Review half of the lenses its brief names or its files match, reading no other lens. The `orchestrate` skill SHALL name the lenses in every `implementer` and `reviewer` brief.

#### Scenario: TypeScript change with a retry loop
- **WHEN** a brief names the lenses `typescript` and `state`
- **THEN** the agent reads those two lens files and no other

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
