## ADDED Requirements

### Requirement: Branch state in status JSON
Each branch of `desk status --json` SHALL carry `state`, computed once in the CLI: `CI failed` when a run of the head sha did not pass, `fixes needed` for an on-head `FIXES`, `DO NOT` or `MERGE AFTER` verdict, `rebase` when behind, then `ready` only when every run of the head sha passed (or the repo has no gh) and the merge gate's `mergeOk` holds, else `needs review`; with CI not yet decided `CI running`, `CI stale` (runs, none on the head), `no CI yet` or `CI unknown` (lookup failed). It SHALL add `verdictOld: true` when the newest verdict names another commit.

#### Scenario: Several runs of the head
- **WHEN** one run of the head sha succeeded and another failed
- **THEN** `state` is `CI failed`, whichever run is newest

#### Scenario: Ready is the merge gate
- **WHEN** CI passed on the head and the newest verdict is `MERGE @<head>`
- **THEN** `state` is `ready`; with a verdict on another commit or none it is `needs review`
