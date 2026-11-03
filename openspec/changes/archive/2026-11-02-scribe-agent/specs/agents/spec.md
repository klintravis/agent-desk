## ADDED Requirements

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
