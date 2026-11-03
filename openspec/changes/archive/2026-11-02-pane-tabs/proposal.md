## Why

The Desk pane prints the `desk status` text under a divider: `#` headers and long lines, hard to scan (T-55).

## What Changes

- The pane draws the status JSON as sections on three tabs (Work, Branches, Desk) instead of the status text; no field is lost.
- Waiting owner decisions and the meters stay above the tabs, so a closed tab can never hide them.
- CI and verdicts are coloured; green only for a result that covers the branch head.
- `desk status` and its JSON do not change.

## Capabilities

### Modified Capabilities
- `plugin-ui`: the Desk pane's layout.
