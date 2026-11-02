## ADDED Requirements

### Requirement: Concise reply rule for subagents
Output styles do not reach subagents, so for `SubagentStart`, when the desk's `outputStyle` is `Concise`, the context SHALL end its rules with `- Reply concisely: lead with the result, no preamble or recap; keep full detail in errors, failing output and security findings.` For `SessionStart`, or any other style, it SHALL NOT.

#### Scenario: Subagent in a Concise desk
- **WHEN** `SubagentStart` fires and `outputStyle` is unset or `Concise`
- **THEN** the context contains the line

#### Scenario: Session start
- **WHEN** `SessionStart` fires
- **THEN** the context does not contain the line (the session's own output style applies)
