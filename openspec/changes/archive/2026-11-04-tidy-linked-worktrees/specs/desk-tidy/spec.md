## MODIFIED Requirements

### Requirement: Stray worktree folders
Tidy SHALL list a directory directly in the worktrees folder as stray when its name is a configured git repo's
`worktreePrefix` followed by a valid slug and no configured git repo's `git worktree list` names that path. A directory
matching no prefix, or a file, SHALL NOT be listed. When `git worktree list` fails for a repo, that repo's folders SHALL be
listed as kept with the reason, not as stray. Tidy SHALL NOT delete, move or write into a stray folder, with or without
`--apply`. The JSON report SHALL carry them under `strayFolders`. The worktrees folder itself MAY be a symlink or
junction: tidy SHALL scan the folder it points to, and that is the only link it follows.

#### Scenario: Linked worktrees folder
- **WHEN** the worktrees folder is a link to a folder holding `a-gone`, which no repo's `git worktree list` names
- **THEN** it is listed as stray, and `--apply` changes nothing under the link or anywhere else

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
