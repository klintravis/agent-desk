## Why

`desk todo set T-1 --status finished` writes a status the schema does not list, and `todo set T-1 --parent T-2` can make a todo its own ancestor or point at a todo that does not exist (T-176). Both corrupt the tree silently.

## What Changes

- `todo add|set|start|split` refuse a `--status` outside `open, active, blocked, done, dropped`: exit 1, nothing written.
- `todo add|set|start` refuse a `--parent` that does not exist, or that is the todo itself or one of its descendants: exit 1, nothing written.
- Only new writes are checked; lines already in `todo.jsonl` are untouched.

## Capabilities

### Modified Capabilities
- `todos-and-board`: the status commands.
