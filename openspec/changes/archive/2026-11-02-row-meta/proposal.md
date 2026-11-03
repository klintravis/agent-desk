## Why

The meta on the active todo row (T-68) is all or nothing, so on most pane widths it is hidden and the row does not say who works on a todo or where (T-74; owner ruling T-72).

## What Changes

- The id row of an active todo shows the id and summary (or title) and one short label: `wt:<slug>` when the todo has a slug, else the owner, else none.
- The head is cut first; the label stays visible. A label wider than the pane is cut at the edge too.
- Status, area, size, priority, change and model no longer appear on that row (`desk todo show` has them).

## Capabilities

### Modified Capabilities
- `plugin-ui`: Active todo row.
