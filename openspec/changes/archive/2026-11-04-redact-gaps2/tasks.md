## 1. Implementation

- [x] 1.1 `scrubSecrets` in `hooks/redact.ts` masks URL passwords before vendor shapes
- [x] 1.2 `maskUrlPasswords` in `hooks/secretpatterns.mjs`: one walk for the scrubber and `hasSecret`, keeps an exact placeholder or template, takes a user holding `@`, skips a port, goes on to later hosts
- [x] 1.3 `NAMED` takes `PASS_NAME` and `PASSWORD_FLAG`; `PASSWORD_NAMED` takes `PASSWORD_FLAG` and `pass` after a letter or digit and `_`, `.` or `-`, or after `--`

## 2. Tests and docs

- [x] 2.1 Hidden and refused cases, look-alikes that must pass, linear time at 8,000,000 characters and the second scrub in `hooks/redact.test.ts`
- [x] 2.2 README, CHANGELOG
