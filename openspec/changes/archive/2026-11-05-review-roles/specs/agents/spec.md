## ADDED Requirements

### Requirement: Structure reviewer
The kit SHALL ship an agent `structure-reviewer`, model `opus`, effort `medium`, with the tools `Read`, `Grep`, `Glob`, `Bash` and `Skill` only, that follows the `structure-rubric` skill (a condensed form of the vendored `thermo-nuclear-code-quality-review`) on a worktree branch's diff, or, given paths, returns a refactor's target shape. It SHALL change nothing and SHALL post no board verdict. The `orchestrate` skill's Approach by kind section SHALL be the one place that says when it runs: once per branch, beside the `reviewer`, for a refactor or a change over about 300 changed lines outside test files or pushing a file past 1000 lines. Its blockers SHALL join the must-fix list (see Validator).

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
