## Why

`desk init` is documented in the README but only referenced by other specs, and the Dispatch requirement omits `home` (T-12, T-34).

## What Changes

- New capability `desk-init` describing current behaviour of `lib/init.mjs`: repo entries, flags, files written, never overwriting, the kit pin, the npm install step.
- `desk-cli` Dispatch lists `home`.
- No code change.

## Capabilities

### New Capabilities
- `desk-init`: what `desk init` writes and detects.

### Modified Capabilities
- `desk-cli`: requirement `Dispatch` (adds `home`).

## Impact

Specs, README, inventory, CHANGELOG (Docs entry). No behaviour change.
