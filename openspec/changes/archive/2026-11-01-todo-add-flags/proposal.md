## Why

`todo add --prio abc` stored `prio: null` silently, and a title starting with `--` (`todo add "--foo"`) was parsed as a flag, so the title was lost (T-13).

## What Changes

- `--prio` (any `todo` subcommand, via the shared flag parser) must be an integer; otherwise exit 1 with `--prio needs an integer, got ...`, nothing written.
- `--` ends the flags: `todo add -- "--foo"` stores the title `--foo`. No other flag syntax changes.

## Capabilities

### Modified Capabilities
- `todos-and-board`: requirement `todo add` (prio validation, `--` end-of-flags).

## Impact

`bin/desk.mjs` `flags`, README Todos section, CHANGELOG. Breaking only for callers that relied on a non-numeric prio becoming `null`.
