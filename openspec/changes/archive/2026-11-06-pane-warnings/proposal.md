## Why

`desk status --json` carries `warnings` when `desk.config.json` is refused (T-277), but the Desk pane drew a bare screen without saying why (T-280).

## What Changes

- The Desk pane shows each status `warnings` entry as an orange `Warning: <msg>` line beside its error line.

## Capabilities

### Modified Capabilities
- `plugin-ui`: new requirement, Desk pane warnings.
