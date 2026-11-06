## Why

`desk check` decided that `claude` was missing by matching the English text "not recognized" in the shell's stderr. On a non-English Windows the text differs, so a missing `claude` read as a failing step instead of a skip (T-261).

## What Changes

- The probe reads the spawn error `ENOENT` or the shell's exit code (9009 for cmd; on Windows a plain 1 is settled by `where claude`), never the message.

## Capabilities

### Modified Capabilities
- `desk-cli`: the "Missing tool" scenario of "Check".
