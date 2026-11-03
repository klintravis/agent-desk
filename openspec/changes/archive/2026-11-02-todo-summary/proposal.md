## Why

Active todos take several lines each in the Desk pane (full title, meta line, state, next), so the pane no longer gives a quick glance at what is being worked on (T-68).

## What Changes

- Optional todo field `summary` (about 50 characters, cut to 60): `todo add --summary`, `todo set T-n --summary`; in both schemas; carried by `desk status --json`.
- The Work tab shows each active todo as one row: id and summary (the title when there is none), cut at the edge, never wrapped. The owner/slug/model meta stays on that row only if it fits.
- `state:` and `next:` lines are cut to one row each, so a todo takes at most three rows; the full text stays in `todo show`.
- Owner decisions, `todo show` and `todo list` are unchanged.
- The `handoff`, `kickoff` and `orchestrate` skills ask for a summary on new todos.
- Existing todos are not touched; records stay valid without the field.

## Capabilities

### Modified Capabilities
- `todos-and-board`: `todo add` / `todo set` take `--summary`.
- `plugin-ui`: the active todo row of the Desk pane.
