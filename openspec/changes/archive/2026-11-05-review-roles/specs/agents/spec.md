## ADDED Requirements

### Requirement: Structure reviewer
The kit SHALL ship an agent `structure-reviewer`, model `opus`, effort `high`, with the tools `Read`, `Grep`, `Glob`, `Bash` and `Skill` only, that follows the vendored `thermo-nuclear-code-quality-review` skill on a worktree branch's diff. It SHALL change nothing and SHALL post no board verdict. The `orchestrate` skill SHALL start it as task `review-structure` in parallel with the `reviewer` when a change passes about 150 lines, is a refactor, or pushes a file past 1000 lines, and SHALL merge its blockers into the reviewer's findings for one fix round.

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
