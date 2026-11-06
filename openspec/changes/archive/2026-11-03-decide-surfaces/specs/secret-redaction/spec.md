## MODIFIED Requirements

### Requirement: What counts as a secret
Vendor key shapes, private keys, connection-string passwords and high-entropy tokens next to a key's name SHALL be hidden as `SECRET`.

#### Scenario: Vendor shapes
- **WHEN** text holds an Anthropic, OpenAI, GitHub, Slack, AWS, Stripe, Google, npm, GitLab or SendGrid key, a JWT, or a Slack or Discord webhook URL
- **THEN** it is hidden whatever its entropy
- **AND** a bare `sk-` run counts as an OpenAI key only when a digit falls within 100 characters of the prefix: `risk-based-rollout-for-every-branch` is kept, and a real key with no digit in that window is not caught by this shape

#### Scenario: Private key and URL password
- **WHEN** text holds a private key block (PEM or PGP, from its opening marker through its END marker), or `scheme://user:<password>@host`
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
