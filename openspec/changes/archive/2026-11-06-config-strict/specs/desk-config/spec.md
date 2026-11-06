## ADDED Requirements

### Requirement: Unknown keys refused
`loadConfig` SHALL throw `${file}: ...` naming the key and where it sits for a key that `schemas/desk-config.schema.json` does not list at the top level (`$schema` is listed) or in a `repos` entry, and for a key other than `model` and `effort` in a `tasks` entry. It SHALL also throw for a `tasks` that is not an object, a `tasks` or `repos` entry that is not an object, and a file whose top level is not an object. The allowed keys SHALL be read from that schema, not listed a second time. The CLI SHALL refuse; the hooks (`scripts/merge-guard.mjs`, `scripts/subagent-context.mjs`) SHALL load with `{ strict: false }`, which ignores unknown keys and still throws for every type or value error, so an older plugin copy cannot fail open on a key only a newer kit knows.

#### Scenario: Typo in a repo
- **WHEN** a repo entry has `chek`
- **THEN** loading fails with `unknown key "chek" in repos[0]`

#### Scenario: Typo in a tasks entry
- **WHEN** `tasks.review.modle` is set
- **THEN** loading fails naming `modle` and `tasks.review`

#### Scenario: Hook ignores an unknown key
- **WHEN** a hook loads a config holding an unknown key
- **THEN** it loads and the merge guard still refuses a protected-branch push

#### Scenario: Tasks entry of the wrong type
- **WHEN** `tasks.review` is `"opus"`
- **THEN** loading fails naming `tasks.review`
