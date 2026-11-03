## ADDED Requirements

### Requirement: Stray worktree folders
Tidy SHALL list a directory directly in the worktrees folder as stray when its name is a configured git repo's
`worktreePrefix` followed by a valid slug and no configured git repo's `git worktree list` names that path. A directory
matching no prefix, or a file, SHALL NOT be listed. When `git worktree list` fails for a repo, that repo's folders SHALL be
listed as kept with the reason, not as stray. Tidy SHALL NOT delete, move or write into a stray folder, with or without
`--apply`. The JSON report SHALL carry them under `strayFolders`.

#### Scenario: Leftover folder
- **WHEN** the worktrees folder holds `a-gone`, which `git worktree list` of repo `a` does not name
- **THEN** it is listed as stray and `--apply` leaves it and its files in place

#### Scenario: Known worktree
- **WHEN** the folder is a worktree that `git worktree list` names
- **THEN** it is not listed

#### Scenario: Listing fails
- **WHEN** `git worktree list` fails for repo `a`
- **THEN** its folders are kept with the reason and none is stray

#### Scenario: Foreign folder
- **WHEN** the worktrees folder holds `notes` matching no repo prefix
- **THEN** it is not listed

## MODIFIED Requirements

### Requirement: Report by default
`desk tidy` SHALL only report and write nothing. The report SHALL list dead owners, unknown owners, orphan files, kept
files and folders, stray worktree folders and review candidates, each with its reason. A missing `todo.jsonl`, `board.jsonl`, `streams` folder, scratch folder
or transcript folder SHALL count as empty. An unknown flag or a positional argument SHALL be an error.

#### Scenario: Report writes nothing
- **WHEN** `desk tidy` runs on a desk with a dead owner, an orphan file and a stale todo
- **THEN** all three are listed
- **AND** `todo.jsonl`, `board.jsonl`, `streams/` and the scratch folder are unchanged

#### Scenario: Nothing to do
- **WHEN** `desk tidy` runs on a desk with no leftovers
- **THEN** it prints one line saying nothing to tidy and exits 0

#### Scenario: Unknown flag
- **WHEN** `desk tidy --force` runs
- **THEN** stderr names the flag, the exit code is 1 and nothing is written

### Requirement: JSON report
`desk tidy --json` SHALL print the report as one JSON object with the keys `dead`, `unknownOwners`, `orphans`, `kept`,
`strayFolders`, `candidates` and `applied`. `applied` SHALL be empty without `--apply`.

#### Scenario: JSON report
- **WHEN** `desk tidy --json` runs
- **THEN** stdout is one JSON object with those keys and `applied` is empty
