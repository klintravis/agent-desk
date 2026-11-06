## MODIFIED Requirements

### Requirement: What counts as a secret
Vendor key shapes, private keys, connection-string passwords and high-entropy tokens next to a key's name SHALL be hidden as `SECRET`.

#### Scenario: Vendor shapes
- **WHEN** text holds an Anthropic, OpenAI, GitHub, Slack, AWS, Stripe, Google, npm, GitLab or SendGrid key, a JWT, or a Slack or Discord webhook URL
- **THEN** it is hidden whatever its entropy
- **AND** a bare `sk-` run counts as an OpenAI key only when a digit falls within 100 characters of the prefix: `risk-based-rollout-for-every-branch` is kept, and a real key with no digit in that window is not caught by this shape

#### Scenario: Private key and URL password
- **WHEN** text holds a private key block, PEM or PGP (an opening marker of five dashes, `BEGIN`, up to 40 characters with no newline or dash, `PRIVATE KEY`, an optional ` BLOCK`, five dashes, through the first END marker of that shape after it), or `scheme://user:<password>@host`
- **THEN** the whole block, or the password only, is hidden, and the text around it is kept
- **AND** the user may hold up to 200 characters

#### Scenario: URL password holding @
- **WHEN** the password holds up to 10 `@` and no piece after an `@` holds `:`, `?` or `#`, as in `postgres://app:abc@defgh@db.example.com:5432/main`
- **THEN** the whole password is hidden and the host is kept
- **AND** a template placeholder takes no such piece: `postgres://app:${PASS}@h:5432?x=a` and `postgres://app:${PASS}@h:5432?x=a@b` are kept

#### Scenario: Private key block with no END
- **WHEN** no END marker follows the opening marker, as in a truncated paste or a marker quoted alone
- **THEN** everything from the opening marker to the end of the text is hidden, the text before it is kept, and the check behind `desk decide` and the `desk wt merge` PR body counts it as a secret
- **AND** text of many opening markers with no END takes linear time

#### Scenario: Named token
- **WHEN** a run of 16 or more letters and digits, with at least one of each, and entropy of at least 3.0 follows a name such as `key`, `token`, `secret`, `password` or `bearer` and `:` or `=`, or follows `Bearer` and a space
- **THEN** it is hidden, a public prefix such as `re_` or `prod_` included
- **AND** a hex run counts from 24 characters, with entropy of at least 3.0

#### Scenario: Name with a suffix
- **WHEN** a key's name ends in `_`, `.` or `-` and `base`, `prod`, `production`, `dev`, `development`, `stage`, `staging`, `test`, `live`, `qa`, `uat` or a version such as `v2` or `2`, as in `SECRET_KEY_BASE=`, `DB_PASSWORD_PROD=`, `db.password.prod=` or `DB-PASSWORD-PROD=`
- **THEN** it counts as the name without the suffix
- **AND** any other suffix is another name: `SESSION_ID=`, `CACHE_KEY_HASH=`, `KEY_NAME=`, `TOKEN_TTL=` and `PASSWORD_MIN_LENGTH=` keep their value

#### Scenario: Authorization token
- **WHEN** a value that meets the named bar follows `Authorization: token `, in any case, the name or the value quoted or not
- **THEN** it is hidden
- **AND** `Authorization: token bucket is empty`, `Authorization: token ${GITHUB_TOKEN}` and `token` and a hex run with no `Authorization` before it are kept

#### Scenario: Password holding marks
- **WHEN** a run of 8 or more characters follows `password`, `passwd` or `pwd` and `:` or `=`, holds a letter and a digit, has `#`, `$`, `!` or `@` directly after a letter or digit, and holds no `.`
- **THEN** it is hidden as one value
- **AND** `password: $DB_PASS2`, `password: !isValid2`, `password: ${DB_PASS}`, `password: user1@example.com` and `password = config?.db2!.pass` are kept

#### Scenario: Bearer token holding . or ~
- **WHEN** a run of 16 or more characters after `Bearer` and a space holds `.` or `~` and, with those removed, meets the named bar
- **THEN** it is hidden as one value
- **AND** `Bearer config2.auth.accessToken.value3`, `Bearer ~/home/dev/token.file.name` and `Bearer tokens expire after 3600.5 seconds` are kept

#### Scenario: Named code name
- **WHEN** the run after a key's name is a camelCase name, or all its `_` or `-` parts are plain words with at most three trailing digits, as in `key: playerEventBatchV1Schema` or `token: user_profile_settings_v2`
- **THEN** it is kept
- **AND** beside `password`, `passwd` or `pwd` it is hidden if it meets the named bar: people make passwords out of words

#### Scenario: Named key holding a slash
- **WHEN** a run of 24 or more base64 characters (no `_` or `-`) holding `/` follows a key's name, mixes lowercase, uppercase and digits with entropy of at least 3.6, and its segments, joined, do not read as a code name
- **THEN** it is hidden as one value
- **AND** a path beside a key's name, as in `key: /api/v2/keys/rotate`, `key: packages/CoreUtils/src/StringHelpers2/index` or `PWD=/home/dev/src/agent-desk-v2/Hooks`, is kept

#### Scenario: Unnamed token
- **WHEN** a token of 24 or more characters mixes lowercase, uppercase and digits with entropy of at least 3.6
- **THEN** it is hidden

#### Scenario: Hex URL username
- **WHEN** a hex run of 32 or more characters with entropy of at least 3.0 is a URL's username, as in `https://<hex>@github.com/org/repo.git` or `https://<hex>:x-oauth-basic@github.com`
- **THEN** it is hidden
- **AND** a hex run in a URL's host or path, as in `https://<hex>/path` or `https://<hex>:8080/path`, is kept

#### Scenario: Not secrets
- **WHEN** text holds a git SHA or checksum without a key name beside it, a number, a file path, a camelCase or snake-case name, an alphabet constant, or, without a key name beside it, a Stripe object id or publishable key or a YouTube channel or playlist id
- **THEN** it is kept

#### Scenario: Empty URL username
- **WHEN** text holds `redis://:<password>@host`
- **THEN** the password only is hidden
- **AND** `redis://cache:6379/0` is kept

### Requirement: Where it applies
The plugin SHALL hide values in the prompt as typed, in tool results and denial reasons, and in the first message's context blocks.

#### Scenario: Prompt
- **WHEN** the user submits a prompt holding a key
- **THEN** the model gets the placeholder and a toast says `agent-desk: hid <n> value(s) from the prompt`

#### Scenario: Tool result
- **WHEN** a tool result or its error text holds a secret
- **THEN** the result carries the placeholder and a notice under the tool says `agent-desk: hid <n> value(s)`
- **AND** a hook's attached `context` goes back as it came

#### Scenario: Object key
- **WHEN** an object key in a tool result holds a value that would be hidden
- **THEN** the key carries the placeholder, and a placeholder in an object key of a tool's input is swapped back

#### Scenario: Context blocks
- **WHEN** the first message's blocks (CLAUDE.md and the like) hold an email address and a key
- **THEN** only the key is hidden

#### Scenario: Too large to scan
- **WHEN** a string is over 8,000,000 characters or nested 12 levels deep
- **THEN** it is replaced by `[agent-desk: value too large or too deep to scan, withheld]`

#### Scenario: Image payloads
- **WHEN** a value under `data`, `base64`, `b64_json`, `imageData` or `thumbnail` is a long base64 string
- **THEN** it is not scanned

### Requirement: Refusal check
`hasSecret`, the check behind `desk decide`, the `desk wt merge` PR body and the VS Code Decide walk, SHALL report vendor shapes, private keys, connection-string passwords and named keys. It SHALL NOT report an unnamed token: it refuses the text rather than masking it.

#### Scenario: Named key refused
- **WHEN** a ruling or PR body holds `API_TOKEN=` and a value that redaction hides as a named key
- **THEN** `hasSecret` is true

#### Scenario: Unnamed token not refused
- **WHEN** the text holds a high-entropy token with no key's name beside it
- **THEN** redaction hides it and `hasSecret` is false

#### Scenario: Hex URL username refused
- **WHEN** the text holds a hex URL username that redaction hides
- **THEN** `hasSecret` is true: the username slot is as good as a name beside it

#### Scenario: Ordinary text
- **WHEN** the text holds code names or paths beside a key's name, `postgres://app:${PASS}@h:5432?x=a`, or prose such as `password: must be at least 12 characters`
- **THEN** `hasSecret` is false
