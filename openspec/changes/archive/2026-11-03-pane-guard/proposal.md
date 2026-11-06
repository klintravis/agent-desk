## Why

The Desk pane read `s.todos.length` on every render, so a status from an older CLI with no `todos` made the whole pane fail. Defaulting to an empty list would show `Todos 0`, which is false: the CLI did not report todos (T-164).

## What Changes

- The pane renders when `todos` is missing: the tab reads `Todos ?` and its section `unavailable`, like Tokens, Overlaps and Sessions.
- `todos` is optional in the status type.

## Capabilities

### Modified Capabilities
- `plugin-ui`: the "Gap, an older CLI" scenario of "Panels in both surfaces".
