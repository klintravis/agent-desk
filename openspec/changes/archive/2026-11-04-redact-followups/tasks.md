## 1. Implementation

- [x] 1.1 `NAMED` and `PASSWORD_NAMED` take a suffix from `NAME_SUFFIX`; `NAMED` takes `Authorization: token`
- [x] 1.2 New passes: `punctPassword` for a password holding `# $ ! @`, `bearerKey` for a bearer token holding `.` or `~`
- [x] 1.3 `URL_HEX_USER` hides a hex run in a URL's username slot, not gated by `onlyNamed`
- [x] 1.4 `URL_PASSWORD` lets a password hold `@`, a template placeholder excepted, and a user of up to 200 characters; remove the T-194 `shortcut:` comment
- [x] 1.5 `walk` in `hooks/redact.ts` runs `fn` over object keys, and the payload skip still reads the original key

## 2. Tests and docs

- [x] 2.1 Hidden and refused cases, look-alikes that must pass, linear time, second scrub and the walker's keys in `hooks/redact.test.ts`
- [x] 2.2 README, CHANGELOG
