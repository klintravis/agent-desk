## MODIFIED Requirements


### Requirement: Repo entries
`desk init --repo <id>=<path>` (repeatable) SHALL add one `repos` entry per flag. `<id>` SHALL be lowercase letters, digits and dashes, and `<path>` SHALL exist (resolved against the desk folder); a bare `--repo <id>` means the desk folder itself. The stored path SHALL use forward slashes, relative to the desk folder, except that the desk folder itself SHALL be stored as `.` and a path on another drive stays absolute. A path holding no `.git` SHALL become `kind: "folder"`.

#### Scenario: Plain folder
- **WHEN** the path has no `.git`
- **THEN** the entry is `{ id, kind: "folder", path }`

#### Scenario: The desk folder itself
- **WHEN** `--repo me=.` (or a bare `--repo me`) runs
- **THEN** the entry's path is `.`

#### Scenario: Invalid repo
- **WHEN** the id has an uppercase letter or the path does not exist
- **THEN** init fails with an error naming it and the exit code is 1
