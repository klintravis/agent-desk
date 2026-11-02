## ADDED Requirements

### Requirement: Template passwords
A connection-string password that is exactly one template placeholder holding a bare name or dotted path and no default value (`${name}`, `${process.env.NAME}`, `{{name}}`), or `<...>` holding only letters, `_` and `-`, SHALL be kept. Any other connection-string password SHALL be hidden as `SECRET`.

#### Scenario: Placeholder kept
- **WHEN** text holds `postgres://app:${s}@db.host`, `{{db_password}}` or `<password>` in the password position
- **THEN** it is kept as it is

#### Scenario: Literal password hidden
- **WHEN** the password is literal text, contains `$` or a placeholder among other characters (`ab${x}cd`, `${a}${b}`), is an unterminated `${...`, is a placeholder with a default value or expression (`${P:-pw}`, `${a||"pw"}`, `{{p|default('pw')}}`), or is `<...>` holding a digit (`<Zqw7Kp2mXr>`)
- **THEN** the password is hidden

#### Scenario: Environment-variable forms
- **WHEN** the password is `$VAR` or `%VAR%`
- **THEN** it is not exempted by this rule
