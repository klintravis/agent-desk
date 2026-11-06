## Why

A hand-edited or old `board.jsonl` line with no `from`, `ts`, `kind` or `slug` printed `undefined` and `NaN` in the board summary and the claim ages (T-245).

## What Changes

- The board summary and claim ages print `?` for a missing `from`, `ts`, `kind` or `slug`.

## Capabilities

### Modified Capabilities
- `todos-and-board`: gains a requirement for bare board lines.
