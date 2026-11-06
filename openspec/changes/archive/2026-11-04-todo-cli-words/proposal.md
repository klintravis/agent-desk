## Why

`desk todo` lost input without saying so: `add a b c` and `note T-1 a b c` kept the first word, `done --note` dropped the note, an empty note or `set` with no field wrote an empty record, over-long text was cut silently and a takeover by `start` was silent (T-209). Refusing unknown flags waits for an owner ruling (T-214).

## What Changes

- `todo add` and `todo note` join all words as the text.
- `todo done|drop|block|open` take `--note` as well as `--why`.
- An empty `note` and a `set` with no field exit 1 and write nothing.
- Text over its cap (title 160, summary 60, why 1000, other 300) is still cut, with a warning on stderr naming the field.
- `todo start` on a todo another session owns still takes it over and prints the previous owner on stderr.
- `init --repo` writes `.` for the desk folder itself.

## Capabilities

### Modified Capabilities
- `todos-and-board`: requirements "Status commands" and "todo add".
- `desk-init`: requirement "Repo entries".
