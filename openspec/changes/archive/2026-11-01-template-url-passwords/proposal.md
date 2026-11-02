## Why

The connection-string password rule also hides template text in source the model reads: `` `postgres://${user}:${pass}@${host}` `` reaches the model with `${pass}` swapped for a placeholder, so it sees mangled code (T-7).

## What Changes

- A URL password that is one template placeholder and nothing else is kept: `${...}` or `{{...}}` holding a bare name or dotted path, no default value; `<...>` holding only letters, `_` and `-`.
- A placeholder with a default value (`${P:-pw}`, `${a||"pw"}`, `{{p|default('pw')}}`) is hidden: the default is a real password.
- Every other URL password is hidden as before, including one that only contains `$` or braces (`a$x...`, `ab${x}cd`, `${a}${b}`) and an unterminated `${...`.
- `%VAR%` and `$VAR` are not exempted: `$ecret99` is a real password.

## Capabilities

### Modified Capabilities
- `secret-redaction`: new requirement `Template passwords`.

## Impact

`hooks/redact.ts`, `hooks/redact.test.ts`, README, CHANGELOG (inventory checked: no new command, flag or variable). No other redaction rule changes.
