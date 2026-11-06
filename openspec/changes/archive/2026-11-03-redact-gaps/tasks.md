## 1. Implementation

- [x] 1.1 Move the token logic from `hooks/redact.ts` to `hooks/secretpatterns.mjs` as `maskKeys`; `scrubSecrets` calls it
- [x] 1.2 `NAMED` takes `Bearer` plus a space; a named value skips the public-id exemptions; `PASSWORD_NAMED` lets a value built of words count
- [x] 1.3 A second pass finds keys holding `/` beside a key's name (`slashedKey`)
- [x] 1.4 `URL_PASSWORD` takes an empty username
- [x] 1.5 `hasSecret` reports named keys through `maskKeys`
- [x] 1.6 `WebSearch` and `WebFetch` join `NO_RESTORE`

## 2. Tests and docs

- [x] 2.1 Hidden and refused cases, negative cases, linear time, restore loop in `hooks/redact.test.ts`; a PR-body case in `test/merge-policy.test.mjs`
- [x] 2.2 README, `openspec/inventory.md`, CHANGELOG
