## MODIFIED Requirements

### Requirement: Restore in tool calls
A placeholder in a tool call's input SHALL be swapped back for the real value, except for tools that pass the model's words on or send them off the machine.

#### Scenario: Command carries the key
- **WHEN** the model runs `curl -H "Authorization: <placeholder>"`
- **THEN** the command runs with the real key

#### Scenario: Words to another model
- **WHEN** the tool is `Agent`, `SendMessage`, `SubagentHandback` or `AskUserQuestion`
- **THEN** the placeholder stays a placeholder

#### Scenario: Query or URL leaving the machine
- **WHEN** the tool is `WebSearch` or `WebFetch`
- **THEN** the placeholder stays a placeholder, and a URL holding one fails or misses rather than sending the real value

#### Scenario: Unknown placeholder
- **WHEN** a placeholder is not in the vault, for example after a resume
- **THEN** it is left as it is
