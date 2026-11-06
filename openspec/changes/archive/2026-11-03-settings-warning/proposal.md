## Why

`desk settings` read the user's cache keys through the sync helper, which printed the "not ignored by git" warning straight to stderr. With `--json` the warning never reached the `warnings` array (T-111).

## What Changes

- `desk settings` collects the "not ignored by git" warning into `warnings`; plain output prints it once on stderr as `warn <text>`. `desk sync` prints it as before.

## Capabilities

### Modified Capabilities
- `desk-cli`: "Settings command" gains a requirement.
