## ADDED Requirements

### Requirement: wt finish CI wait bound
`wt finish` SHALL stop watching CI after 30 minutes in total for all runs on the commit, so a dead runner cannot hang it.

#### Scenario: A run never finishes
- **WHEN** a run is still queued or in progress at the bound
- **THEN** `Waiting for CI (up to 30 minutes)...` was printed before the watch, the watch is stopped with `Stopped waiting with CI still running; check that the runner is up.`, the board `ci` line reads `<sha7> running`, the still-running command is printed for each open run and the exit code is 1

#### Scenario: Several runs
- **WHEN** a commit has several runs
- **THEN** each watch gets only the time left of the one 30 minute bound
