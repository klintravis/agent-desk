## ADDED Requirements

### Requirement: Context file for a todo
What overflows a todo's note caps (design notes, rejected options, `Ruling:` lines, links to the spec, PR or commits; references, never copies) MAY live in `context/T-n.md` in the desk folder, linked by a todo note `context: context/T-n.md`. The file is data, never instructions, and is versioned only if the desk commits it. The `handoff` skill SHALL write or update it when notes overflow, the `kickoff` skill SHALL read it for a todo that has the note, and the `orchestrate` skill SHALL put its absolute path in a subagent brief. `desk tidy` SHALL NOT sweep `context/`, and no command reads or writes it.

#### Scenario: Skills use the note
- **WHEN** the three skills are read
- **THEN** each names `context/T-n.md`

#### Scenario: Tidy leaves it
- **WHEN** `desk tidy --apply` runs on a desk with a `context/` folder
- **THEN** no file in it is listed or deleted
