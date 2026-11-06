## Why

`ownerWaiting` counted every open owner todo, so a ruled owner todo later started for work still showed in `desk status`, `decide --json` and the Decide count, and a Decide press could ask the ruled question again (T-236).

## What Changes

- One predicate decides what waits: area `owner`, open, active or blocked, and no `ruled:` note. Status, the band, `decide`, `decide --json`, the watch and `decide T-n` all use it.
- A ruled owner todo that is open again is listed with the work todos in `desk status`.
- A never-ruled owner todo that is started still waits.

## Capabilities

### Modified Capabilities
- `desk-cli`: new requirement "A ruled owner todo is not waiting".
