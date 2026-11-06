## ADDED Requirements

### Requirement: Slash-only report skills
`ponytail-debt` and `ponytail-audit` SHALL set `disable-model-invocation: true`, and no other skill of the kit SHALL.

#### Scenario: Only the two report skills
- **WHEN** the kit's `skills/*/SKILL.md` are searched for `disable-model-invocation: true`
- **THEN** exactly `ponytail-debt` and `ponytail-audit` match

### Requirement: Orchestrate review loop in a sibling file
The `orchestrate` skill SHALL keep step 4's must-fix list, board verdict and fix-verification rules, and the unknown-cause report format, in `skills/orchestrate/review-loop.md`, and step 4 SHALL tell the orchestrator to read that file.

#### Scenario: Pointer
- **WHEN** `skills/orchestrate/SKILL.md` step 4 is read
- **THEN** it names `review-loop.md` and the rules for `FIXES NEEDED` and `overrides:` verdicts are in that file
