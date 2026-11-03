## ADDED Requirements

### Requirement: Tokens compaction copies
An all-zero assistant line with the `requestId` of a call already counted SHALL NOT change that call: a compaction copies earlier lines this way.

#### Scenario: Compaction copy
- **WHEN** a transcript has a call with usage, then a later line with the same `requestId` and zero usage
- **THEN** it counts as one call with the first line's usage

### Requirement: Tokens nesting and patterns
`desk tokens --json` rows SHALL carry `depth`, `parent`, `firstFresh` and `firstRead`, and a subagent row with calls and a timestamp SHALL carry `sinceSpawn`. The listing without `--by-worktree` SHALL show depth and parent per row, and, when a subagent has calls, one line with runs, nested runs, first-call share of fresh tokens and cache reads per call, and one line with warm starts by gap, both before the total line.

#### Scenario: Depth and parent
- **WHEN** a subagent's `.meta.json` has `spawnDepth` and `parentAgentId`
- **THEN** its row has that `depth` and `parent`
- **AND** a main session's row has depth 0 and an empty parent
- **AND** a subagent with no parent in its metadata has parent `main`, and depth 1 when `spawnDepth` is missing too

#### Scenario: First call
- **WHEN** a transcript has calls
- **THEN** `firstFresh` is the input plus cache write of its first call and `firstRead` that call's cache read

#### Scenario: Gap since the last spawn
- **WHEN** rows of the window have the same agent type, ignoring effort, and the same model
- **THEN** `sinceSpawn` is the seconds since the previous one started, across sessions, and null on the first

#### Scenario: Warm starts
- **WHEN** the listing runs and a subagent has calls
- **THEN** each subagent counts in one of `<5m`, `5-60m`, `>60m` or `first` by `sinceSpawn`, as warm when `firstRead` is at least 5000

#### Scenario: Total stays last
- **WHEN** the pattern lines print
- **THEN** the total line is still the last line
- **AND** `--by-worktree` prints neither pattern line nor the depth and parent columns
