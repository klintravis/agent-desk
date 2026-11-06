## Why

`desk todo done T-1 --reason x` ignored `--reason`, and `desk todo done T-1 T-2` closed T-1 and ignored `T-2`: the caller believed it did more than it did (T-214 ruling, T-225).

## What Changes

- **BREAKING:** `todo add`, `set`, `start` and `split` exit 1 on a flag that is not a field of the todo schema (`todo set T-1 --sumary x` stored a junk `sumary` field), and `set` and `start` on a word after the todo id.
- **BREAKING:** `todo done`, `drop`, `block`, `open` and `note` exit 1, naming what they refused and writing nothing, on a flag they do not take (`done`, `drop`, `block`, `open` take `--why` and `--note`; `note` takes none) or on a word past the todo id (`note` takes the text as words).
- No new option or config. Every form in the shipped skills, agents, hooks and README still works.

## Capabilities

### Modified Capabilities
- `todos-and-board`: Status commands.
