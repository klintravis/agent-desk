## Why

The sidebar showed no running sessions, so a desk with live sessions looked idle (T-148). `desk status --json` already carries `sessions`; `statusTree` dropped it.

## What Changes

- New `Running sessions` section after `Active todos`, open by default: one row per session (title, else the session id; the id and agent count as description; agents as tooltip lines).

## Capabilities

### Modified Capabilities
- `vscode-extension`: Status view sections.

## Decisions

- A null `sessions` (transcripts unreadable) draws as an empty section, as `overlaps` does.
- No open-todos section and no new `STATUS_VERSION`.
