## Why

`desk todo set T-1 --notes x` exits 0 but stores `notes` as a string, and every later `todo note` and `todo list` crashes with `cur.notes.push is not a function`. `--id` renames the todo in the list and `--created` rewrites its creation time (T-189).

## What Changes

- `todo` commands refuse `--id`, `--created` and `--notes`: exit 1, nothing written.
- A `todo.jsonl` that already holds a non-array `notes` value reads fine: the value is kept as one note.

## Capabilities

### Modified Capabilities
- `todos-and-board`: the status commands.
