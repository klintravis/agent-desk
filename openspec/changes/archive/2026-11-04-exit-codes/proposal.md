## Why

Four inputs a script would call wrong were accepted silently: a rejected `board post` and `board check` with no slug exited 0, a `harnesses` value that is neither `claude` nor `copilot` made `desk sync` write nothing, and a malformed `floor` entry set no minimum (ruling T-232, "refuse all four").

## What Changes

- **BREAKING:** `desk board post` with a bad kind or slug exits 1 (it still prints `board: bad post ...` and appends nothing). Only the command does; the desk's own posts (`wt`, `status --watch`) still never fail their caller.
- **BREAKING:** `desk board check` with no slug prints `usage: desk board check <slug>` and exits 1.
- **BREAKING:** `loadConfig` throws for a `harnesses` value that is not a non-empty array of `claude` and `copilot`.
- **BREAKING:** `loadConfig` throws for a `floor` that is not an object, and for a `floor` entry that is not an object or has a key other than `model` and `effort`.
- **BREAKING:** `desk init --harness` refuses any value other than `claude` and `copilot` (a misspelling, an empty item) before writing anything.
- `desk check` loads the desk's own `desk.config.json` through `loadConfig`, so it fails on what the desk refuses; a file that does not parse prints `does not parse`, not the parser's quote of it.

## Capabilities

### Modified Capabilities
- `todos-and-board`: Board kinds and posting; board check.
- `desk-cli`: Check.
- `desk-init`: Flags.
- `desk-config`: Top-level keys and defaults; Tasks and floor keys.
