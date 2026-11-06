## MODIFIED Requirements

### Requirement: Refresh
The views SHALL run the status at start, every 60 seconds and on the Refresh command, one run at a time; a request during a run SHALL cause one more run after it, a plain one if any request was plain. Until the first result they SHALL say `Loading desk status…`. A failing run SHALL show its error and keep the last rows.

A `FileSystemWatcher` on the desk's `todo.jsonl`, `board.jsonl` and `decisions.jsonl` SHALL run `desk status --cached --json` 300 ms after the last event of a burst. A recorded ruling SHALL run it too. The watcher SHALL follow the desk when the workspace folders change and SHALL be disposed with its pending debounce when the extension stops. The 60 second run stays, as the fallback for a watcher that fails silently.

#### Scenario: Failing run
- **WHEN** a run exits non-zero
- **THEN** each view's message holds its stderr and its rows stay as they were

#### Scenario: The run after a ruling
- **WHEN** a ruling is recorded while a status run is in flight
- **THEN** another run follows, so the decision leaves the view without waiting a minute

#### Scenario: A burst of writes
- **WHEN** the watcher fires several times within 300 ms
- **THEN** one `desk status --cached --json` runs

#### Scenario: The extension stops
- **WHEN** the extension is disposed with a debounce pending
- **THEN** the watcher is disposed and no run follows
