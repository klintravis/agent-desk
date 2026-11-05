## ADDED Requirements

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
The kit SHALL ship a `stack-lens` skill whose table maps each lens to one file under `lenses/`, each file with a `## Build` and a `## Review` section. The `implementer` SHALL follow the Build half and the `reviewer` SHALL check the Review half of the lenses its brief names or its files match, reading no other lens. The `orchestrate` skill SHALL name the lenses in every `implementer` and `reviewer` brief.

#### Scenario: TypeScript change with a retry loop
- **WHEN** a brief names the lenses `typescript` and `state`
- **THEN** the agent reads those two lens files and no other
