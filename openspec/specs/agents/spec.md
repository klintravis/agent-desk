# agents Specification

## Purpose
The kit's delegation agents in `agents/`, as far as their scope is a promise. Starts with `scribe`.

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
