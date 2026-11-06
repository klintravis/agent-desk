## MODIFIED Requirements

### Requirement: Desk pane refresh
The pane SHALL read everything under the rows from one `desk status --json` run. It runs at
start and every 60 seconds, with a 45 s timeout. It SHALL show `Loading desk status…` until the first
result. A failing run or unparsable output SHALL show its stderr or `desk status failed: <error>`.

Every 2 seconds the pane SHALL stat `todo.jsonl`, `board.jsonl` and `decisions.jsonl` in the desk, and when the
size or mtime of one differs from what the last run started on, run `desk status --cached --json`. One run SHALL
go at a time: a request during a run SHALL cause one more run after it, a plain one if any request was plain.
The pane SHALL NOT watch while no desk path is known; the 60 second run stays.

#### Scenario: Reads JSON, not text
- **WHEN** the pane refreshes
- **THEN** it runs `desk status --json`, draws from its fields, and no line of the status text appears

#### Scenario: A local change
- **WHEN** a look finds `todo.jsonl` changed
- **THEN** `desk status --cached --json` runs once, and the next look with nothing changed runs nothing

#### Scenario: A burst during a run
- **WHEN** a run is in flight and refreshes are asked meanwhile, one of them plain
- **THEN** exactly one more run follows, the plain one
