## ADDED Requirements

### Requirement: CHANGELOG duplicate entries
`npm test` SHALL fail when a section of `CHANGELOG.md` holds the same entry line twice or two entries that name the same `OpenSpec change \`x\``. `bump` SHALL refuse, naming the duplicate and writing nothing, when `## Unreleased` has one. An entry placed under the wrong version is not detected.

#### Scenario: Reworded entry kept twice
- **WHEN** a union merge leaves two entries naming `OpenSpec change \`x\`` under `## Unreleased`
- **THEN** `npm test` fails and `bump` exits 1 with no file changed

#### Scenario: Same change in two versions
- **WHEN** two different version sections each name `OpenSpec change \`x\``
- **THEN** no gap is reported
