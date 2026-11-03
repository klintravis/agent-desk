# secret-redaction Specification

## Purpose

Secrets, email addresses and public IP addresses never reach the model as themselves. They are swapped
for a stable placeholder and swapped back inside tool calls. Implemented in `hooks/redact.ts`, wired in
`hooks/register.ts`. It runs everywhere, in a desk or not, with no options.

## Requirements

### Requirement: Placeholders
A hidden value SHALL be replaced by `[REDACTED-<KIND>-<8 hex>]`, `KIND` being `SECRET`, `EMAIL` or `IP`.

#### Scenario: Stable per value
- **WHEN** the same value is hidden twice in a session
- **THEN** it gets the same placeholder both times, and two different values get different ones

#### Scenario: Random id
- **WHEN** a placeholder is minted
- **THEN** its id is random, not a hash of the value, and a clash with an existing one is retried

### Requirement: What counts as a secret
Vendor key shapes, private keys, connection-string passwords and high-entropy tokens next to a key's name SHALL be hidden as `SECRET`.

#### Scenario: Vendor shapes
- **WHEN** text holds an Anthropic, OpenAI, GitHub, Slack, AWS, Stripe, Google, npm, GitLab or SendGrid key, a JWT, or a Slack or Discord webhook URL
- **THEN** it is hidden whatever its entropy
- **AND** a bare `sk-` run counts as an OpenAI key only when a digit falls within 100 characters of the prefix: `risk-based-rollout-for-every-branch` is kept, and a real key with no digit in that window is not caught by this shape

#### Scenario: Private key and URL password
- **WHEN** text holds a `-----BEGIN ... PRIVATE KEY-----` block, or `scheme://user:<password>@host`
- **THEN** the whole block, or the password only, is hidden

#### Scenario: Named token
- **WHEN** a run of 16 or more letters and digits, with at least one of each, and entropy of at least 3.0 follows a name such as `key`, `token`, `secret`, `password` or `bearer` and `:` or `=`
- **THEN** it is hidden

#### Scenario: Unnamed token
- **WHEN** a token of 24 or more characters mixes lowercase, uppercase and digits with entropy of at least 3.6
- **THEN** it is hidden

#### Scenario: Not secrets
- **WHEN** text holds a git SHA or checksum without a key name beside it, a number, a file path, a camelCase or snake-case name, an alphabet constant, a Stripe object id or publishable key, or a YouTube channel or playlist id
- **THEN** it is kept

### Requirement: Email and IP addresses
Email addresses and public IP addresses SHALL be hidden as `EMAIL` and `IP`.

#### Scenario: Person's address
- **WHEN** text holds `jo.doe@corp.io` or a public IPv4 or IPv6 address
- **THEN** it is hidden

#### Scenario: Kept addresses
- **WHEN** text holds a `users.noreply.github.com`, `noreply@` or `no-reply@` address, an example or placeholder address (`you@example.com`, `john@...`), or a private, loopback, link-local, CGNAT, multicast, benchmarking or documentation IP
- **THEN** it is kept

### Requirement: Where it applies
The plugin SHALL hide values in the prompt as typed, in tool results and denial reasons, and in the first message's context blocks.

#### Scenario: Prompt
- **WHEN** the user submits a prompt holding a key
- **THEN** the model gets the placeholder and a toast says `agent-desk: hid <n> value(s) from the prompt`

#### Scenario: Tool result
- **WHEN** a tool result or its error text holds a secret
- **THEN** the result carries the placeholder and a notice under the tool says `agent-desk: hid <n> value(s)`
- **AND** a hook's attached `context` goes back as it came

#### Scenario: Context blocks
- **WHEN** the first message's blocks (CLAUDE.md and the like) hold an email address and a key
- **THEN** only the key is hidden

#### Scenario: Too large to scan
- **WHEN** a string is over 8,000,000 characters or nested 12 levels deep
- **THEN** it is replaced by `[agent-desk: value too large or too deep to scan, withheld]`

#### Scenario: Image payloads
- **WHEN** a value under `data`, `base64`, `b64_json`, `imageData` or `thumbnail` is a long base64 string
- **THEN** it is not scanned

### Requirement: Restore in tool calls
A placeholder in a tool call's input SHALL be swapped back for the real value, except for tools that pass the model's words on.

#### Scenario: Command carries the key
- **WHEN** the model runs `curl -H "Authorization: <placeholder>"`
- **THEN** the command runs with the real key

#### Scenario: Words to another model
- **WHEN** the tool is `Agent`, `SendMessage` or `AskUserQuestion`
- **THEN** the placeholder stays a placeholder

#### Scenario: Unknown placeholder
- **WHEN** a placeholder is not in the vault, for example after a resume
- **THEN** it is left as it is

### Requirement: Memory only, fails open
The values SHALL live in the session's memory only, and a redaction fault SHALL NOT block a send.

#### Scenario: Nothing on disk
- **WHEN** the session ends
- **THEN** no value was written anywhere

#### Scenario: Redactor error
- **WHEN** scrubbing the prompt throws
- **THEN** the prompt goes through unchanged

### Requirement: Template passwords
A connection-string password that is exactly one template placeholder holding a bare name or dotted path and no default value (`${name}`, `${process.env.NAME}`, `{{name}}`) SHALL be kept. Any other connection-string password, `<...>` included, SHALL be hidden as `SECRET`.

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
