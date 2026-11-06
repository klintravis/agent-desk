## Why

Two follow-ups from the redaction review (T-193, T-194). Real secrets got through in shapes people use: a key's name with a suffix (`SECRET_KEY_BASE=`, `DB_PASSWORD_PROD=`), GitHub's `Authorization: token` form, a password holding `# $ ! @`, a bearer token holding `.` or `~`, a hex token as a URL's username. The walker scrubbed values but not object keys. A URL password holding `@` stayed raw (`scheme://app:p@ssw0rd@db`) or was half hidden (`app:abc@defgh@db` hid only `abc`). Each shape was reproduced before the fix; the walker leak was traced from the code, and its test fails on the old line.

T-192 dropped by ruling T-235: object-store paths beside a key's name stay refused, and no key stays raw that develop hides.

## What Changes

- A key's name may carry one suffix from a short list (`base`, `prod`, `production`, `dev`, `development`, `stage`, `staging`, `test`, `live`, `qa`, `uat`, `v2` and other numbered forms), after `_`, `.` or `-`: `db.password.prod=` and `DB-PASSWORD-PROD=` count. `_NAME`, `_ID`, `_URL`, `_TTL`, `_HASH` and `_MIN_LENGTH` are not on it.
- `Authorization: token <value>` counts as a name, quoted JSON form included. A bare `token <hex>` with no `Authorization` does not.
- Beside `password`, `passwd` or `pwd`, a value holding `#`, `$`, `!` or `@` counts when it has a letter, a digit, one of those marks directly after a letter or digit, and no `.`.
- After `Bearer`, a token holding `.` or `~` is hidden as one value when, with those characters removed, it meets the named bar.
- A hex run of 32 or more characters with entropy of at least 3.0 in a URL's username slot is hidden and refused, with or without a password after it.
- `URL_PASSWORD` lets a password hold `@`: up to 10 of them, as long as no piece after an `@` holds `:`, `?` or `#`, and never when the password is a template placeholder. `postgres://app:${PASS}@h:5432?x=a` keeps passing. The user before the password may hold 200 characters, as far as `URL_HEX_USER` goes, up from 80.
- The walker scrubs object keys as well as values, and restores a placeholder in a key of a tool's input. An image payload is still skipped by the key's original name.
- Known cost: a person's address or a public IP used as an object key now becomes a placeholder, as it does as a value. Code or prose after `password` that holds a mark is hidden and refused: `dbPass2!`, `$DB1$DB2`, `issue#123`.
- Not changed: a password holding `.`, `/`, `=` or `:`, or with its only mark in front (`!Passw0rd1`), stays raw, as does a marked value beside another key name (`secret: foo#bar1`). A URL password with `:`, `?` or `#` after an `@`, or with more than 10 `@`, is hidden only up to there. An unnamed mixed-case URL username is still hidden by the unnamed rule and not refused.
- Not changed: `NO_RESTORE` and the restore step, as ruled in T-191.
- Not changed: scrubbing a URL password that is already a placeholder mints a second placeholder, and `hasSecret` reports it. That behaviour predates this change.

## Capabilities

### Modified Capabilities
- `secret-redaction`: "What counts as a secret", "Where it applies", "Refusal check".
