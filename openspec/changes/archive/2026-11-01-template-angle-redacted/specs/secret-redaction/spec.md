## MODIFIED Requirements

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
