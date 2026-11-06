## Why

Secret redaction let real keys through in shapes people commonly use, because a code-name or public-id exemption won over the key's name beside the value: a hex token after `Bearer`, `RESEND_API_KEY=re_...`, `DB_PASSWORD=prod_...`, a password made of words, a key holding `/`, and a password after an empty URL username (T-190). The check behind `desk decide` and the `desk wt merge` PR body did not look at named keys at all. `WebSearch` and `WebFetch` got the real value back through restore, so a placeholder the model copied into a query or URL left the machine as the secret.

## What Changes

- A key's name beside a value now outranks the public-id exemptions. `Bearer` followed by a space counts as a name, hex included.
- Beside `password`, `passwd` or `pwd`, a value built of words counts too, as long as it has a digit.
- A value holding `/` beside a key's name is hidden when it is 24 or more base64 characters (no `_` or `-`, which mark a path), mixes lowercase, uppercase and digits, and its segments, joined, do not read as a code name.
- A connection string's username may be empty.
- `hasSecret` also reports named keys, not unnamed tokens: it refuses text rather than masking it, so a false positive blocks a ruling or a PR. The token logic moves to `hooks/secretpatterns.mjs` to be shared.
- `WebSearch` and `WebFetch` join `NO_RESTORE`. A URL holding a public IP, an address or a long mixed-case id now fails in `WebFetch`, and a command can still fetch it.
- Known cost: a Stripe publishable key or a public id beside a key's name, and a code name with a digit beside `password`, become placeholders in what the model sees, and are refused by `hasSecret`. Tool calls still get the real value.
- Not changed: a URL password holding `@` is not fully hidden (`scheme://app:p@ssw0rd@db` stays raw; `app:abc@defgh@db` hides only `abc`); a plain `[^\s/]{3,200}` would capture `${PASS}@h:5432?x=a` and refuse a PR body that passes today.
- Not changed: MCP tools still get the real value back; that is an owner question.

## Capabilities

### Modified Capabilities
- `secret-redaction`: "What counts as a secret", "Restore in tool calls"; new requirement "Refusal check".
