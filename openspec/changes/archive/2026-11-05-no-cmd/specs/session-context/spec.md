## MODIFIED Requirements

### Requirement: Desk rules
The context SHALL append the desk's `agent-rules.md` (in the desk folder, else `.claude/agent-rules.md`)
and a closing line telling the agent how to run the desk command by absolute path: `desk` in bash, and
in PowerShell or cmd `node` on the desk kit's `bin/desk.mjs` with `DESK_HOME` set to the desk, not `npx desk`.

#### Scenario: Old location
- **WHEN** only `.claude/agent-rules.md` exists
- **THEN** its content is used

#### Scenario: Direct form
- **WHEN** the context is built for a desk
- **THEN** the closing line holds the PowerShell and cmd forms with the desk's real paths
