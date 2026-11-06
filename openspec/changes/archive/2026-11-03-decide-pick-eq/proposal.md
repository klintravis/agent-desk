## Why

`desk decide T-n --pick=2`, one argument, is what a shell and a clicked label both send, so it cannot be told from a ruling and would be recorded as text (T-162). The refusal must also be true on every surface and echo nothing the user typed.

## What Changes

- A ruling whose first argument starts with `--pick=` is refused with one fixed message: nothing is recorded and the todo stays open.
- No new option or config.

## Capabilities

### Modified Capabilities
- `desk-cli`: the `decide` command refuses `--pick=`.
