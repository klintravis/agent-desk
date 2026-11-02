## Why

A real password was written in angle brackets and passed redaction as a template placeholder: `<...>` is not a template form any tool expands, so it cannot tell `<password>` from `<SuperSecret>` (T-43, owner ruling 2026-11-01).

## What Changes

- A URL password in angle brackets (`<password>`, `<SuperSecret>`) is hidden like any other password.
- `${...}` and `{{...}}` holding a bare name or dotted path, no default value, stay kept.

## Capabilities

### Modified Capabilities
- `secret-redaction`: requirement `Template passwords` drops the `<...>` form.

## Impact

`hooks/redact.ts`, `hooks/redact.test.ts`, README, CHANGELOG (inventory checked: no new command, flag or variable).
