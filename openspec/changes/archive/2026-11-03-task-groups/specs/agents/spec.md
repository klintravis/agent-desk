## ADDED Requirements

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
