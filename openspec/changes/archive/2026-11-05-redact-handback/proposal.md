## Why

T-243, a doubt from the T-234 review: `SubagentHandback`, a subagent's final report to its caller, carries a model's words to another model, as `SendMessage` does, yet it was not in `NO_RESTORE`. A placeholder the subagent wrote there was swapped back for the real value, which then reached the caller in places the caller's own `Agent` result scrub does not cover: the report rendered to the user, and a background subagent's report, which arrives as a notification rather than a tool result. Reproduced by the regression test before the fix.

## What Changes

- `SubagentHandback` joins `NO_RESTORE` in `hooks/redact.ts`: a placeholder in its input stays a placeholder.
- Not changed: the caller keeps the placeholder, and its own tool calls restore it from the same vault.

## Capabilities

### Modified Capabilities
- `secret-redaction`: "Restore in tool calls".
