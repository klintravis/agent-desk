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

#### Scenario: URL password holding a vendor key
- **WHEN** a URL password holds a vendor key shape
- **THEN** the whole password becomes one placeholder, never a placeholder inside a placeholder, and a tool call restores it whole

#### Scenario: URL user holding @
- **WHEN** the user before a URL password holds `@`, as in `postgres://me@corp:<password>@db/main`
- **THEN** the password is hidden
- **AND** after such a user, digits and then `,`, `?` or `#` read as a port: `mongodb://a@h1:27017,b@h2:27017/db` and `https://me@host:8443?to=a@b` are kept, and a password of that form stays raw

#### Scenario: Multi-host URL
- **WHEN** a URL lists hosts split by `,` and a later one has `user:<password>@`, as in `mongodb://a:<password>@h1:27017,b:<password>@h2:27017/db`
- **THEN** every password is hidden, whatever the first host's password is, within the limits below: a template or a placeholder does not end the walk
- **AND** a later password stays raw after more than 64 hosts, a host of more than 260 characters, or a host with a user and no password, and one holding both `,` and `:` is hidden only after its last comma
- **AND** a password of 1 or 2 characters stays raw, as `mailto://a:b@c` looks the same, and so does every later password after it: `mongodb://a:pw@h1,b:<password>@h2/db` is not hidden or refused
- **AND** a later host's port, then `?` or `#` and an `@` in the query, reads as a password: `mongodb://a:${P}@h1:27017,h2:27017?to=x@y` is refused

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

#### Scenario: Pass as a name
- **WHEN** `pass` follows no letter, alone or with `db`, `pg`, `sql`, `user`, `root` or `admin` joined before it, in any case, and takes a suffix as above, as in `DB_PASS=`, `PGPASS=`, `dbPass:`, `"pass":` or `--pass=`
- **THEN** it counts as a key's name, and after a letter or digit and `_`, `.` or `-`, or after `--`, as a password's name: `DB_PASS=` and `--pass=` hide a value holding marks, as `--password=` does
- **AND** joined or bare it is a key's name only: `PGPASS=`, `dbPass:` and `PASS=` keep a value holding marks that has no key's shape
- **AND** `bypass=`, `compass:`, `surpass=` and `pass_through=` are not names, and `pass:` right after a letter and one space or tab reads as a sentence: `all tests pass: <sha>` and `user pass: <value>` are kept
- **AND** after anything else it is a name: `CI: pass: <sha>`, `209 pass: <sha>` and `tests  pass: <sha>` (two spaces) are hidden and refused, as `pass: <sha>` is
- **AND** `pass=true`, `PASS=false`, `pass: build#1234` and `DB_PASS=${DB_PASS}` are kept, as beside any other name

#### Scenario: Password flag with a space
- **WHEN** `--password`, `--passwd`, `--pwd` or `--pass` is followed on its line by a space or tab and a value, quoted or not, as in `mysqldump --password <value> main`
- **THEN** it counts as a password's name
- **AND** `--password-file`, `--password-stdin`, `--pass-through`, `--password /run/secrets/database`, `--password $DB_PASSWORD`, `--password <password>`, `--password must be set`, and a value on the next line are kept
- **AND** `-p <value>`, `-p<value>` and single-dash `-password <value>` stay raw, as `mkdir -p` and `ssh -p 22` look the same

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

### Requirement: Template passwords
A connection-string password that is exactly one template placeholder holding a bare name or dotted path and no default value (`${name}`, `${process.env.NAME}`, `{{name}}`) SHALL be kept, and so SHALL one that is exactly one redaction placeholder. Any other connection-string password, `<...>` included, SHALL be hidden as `SECRET`.

#### Scenario: Redaction placeholder kept
- **WHEN** the password is exactly one `[REDACTED-SECRET-...]`, `[REDACTED-EMAIL-...]` or `[REDACTED-IP-...]` with eight lower-case hex digits, as in `postgres://app:[REDACTED-SECRET-1a2b3c4d]@db:5432/main`
- **THEN** it is kept as it is, so a second scrub mints nothing
- **AND** with text before or after it, a second placeholder, another kind, another length or upper-case hex it is a password and is hidden

#### Scenario: Placeholder kept
- **WHEN** text holds `postgres://app:${db_password}@db.host` or `{{db_password}}` in the password position
- **THEN** it is kept as it is

#### Scenario: Literal password hidden
- **WHEN** the password is literal text, contains `$` or a placeholder among other characters (`ab${x}cd`, `${a}${b}`), is an unterminated `${...`, or is a placeholder with a default value or expression (`${P:-pw}`, `${a||"pw"}`, `{{p|default('pw')}}`)
- **THEN** the password is hidden

#### Scenario: Angle brackets hidden
- **WHEN** the password is in angle brackets (`<password>`, `<SuperSecret>`, `<Zqw7Kp2mXr>`)
- **THEN** the password is hidden

#### Scenario: Environment-variable forms
- **WHEN** the password is `$VAR` or `%VAR%`
- **THEN** it is not exempted by this rule

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

#### Scenario: Wider URL and pass shapes refused
- **WHEN** the text holds `DB_PASS=` or `--password` and a value that redaction hides as named, a URL password after a user holding `@`, or the password of a later host, whatever the first host's password is, within the limits of the multi-host URL scenario
- **THEN** `hasSecret` is true

#### Scenario: Masked URL quoted
- **WHEN** a ruling or PR body quotes a URL whose password is exactly one redaction placeholder
- **THEN** `hasSecret` is false, unless another password in the text is raw
- **AND** a placeholder among other characters, as `[REDACTED-SECRET-1a2b3c4d]` with a value joined to it, is true

#### Scenario: Ordinary text
- **WHEN** the text holds code names or paths beside a key's name, `postgres://app:${PASS}@h:5432?x=a`, or prose such as `password: must be at least 12 characters`
- **THEN** `hasSecret` is false
