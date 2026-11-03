## ADDED Requirements

### Requirement: User file
The system SHALL read per-user settings from the path in `AGENT_DESK_SETTINGS` when that variable is set, and otherwise from `~/.agent-desk/settings.json`. The resolver SHALL also take the path as a parameter. The system SHALL NOT write this file. It SHALL accept only `tasks` (per task id, `model` and `effort`), `cache` (`promptCacheTtl`, `subagentPromptCacheTtl`, `idleCompaction`) and `$schema`.

#### Scenario: Override path
- **WHEN** `AGENT_DESK_SETTINGS` names a file
- **THEN** that file is read and `~/.agent-desk/settings.json` is not

#### Scenario: Empty override
- **WHEN** `AGENT_DESK_SETTINGS` is set and empty
- **THEN** no user file is read and no warning is printed

#### Scenario: No file
- **WHEN** the file does not exist
- **THEN** the resolver returns the desk's values with no warning and the user layer is inactive

#### Scenario: Malformed file
- **WHEN** the file does not parse, or its top level is not an object
- **THEN** the resolver warns, ignores the file and does not throw
- **AND** `desk status`, `desk settings`, `desk sync` and `desk check` still exit as they would without it

#### Scenario: Unknown keys
- **WHEN** the file holds a key outside the accepted ones, such as `permissions`, `check` or `apiKey`
- **THEN** the key has no effect and a warning names it without printing its value

#### Scenario: One bad value
- **WHEN** one value is invalid and others are valid
- **THEN** that value warns and is ignored, and the others apply

#### Scenario: Inherited names
- **WHEN** a key is `__proto__` or `constructor`
- **THEN** it warns as unknown and no object's prototype changes

#### Scenario: Tests never read a real file
- **WHEN** the test suite runs the CLI through `test/helpers.mjs`
- **THEN** `AGENT_DESK_SETTINGS` points at a path inside the test's temp folder

### Requirement: Resolved model and effort
For each task id the system SHALL resolve `model` and `effort` independently, in this order, last wins: the table in `skills/orchestrate/SKILL.md` (source `kit`), `tasks` in `desk.config.json` (source `desk`), `tasks` in the user file (source `user`), then `floor` in `desk.config.json` (source `floor`). A user file SHALL NOT affect `subagent_type`, permissions, deny rules, check commands or repo config.

#### Scenario: Kit default
- **WHEN** neither the desk nor the user sets a value for `review`
- **THEN** it resolves to the table's `opus` and `high`, each with source `kit`

#### Scenario: Each value has its own source
- **WHEN** the desk sets `review.model` to `sonnet` and the user sets `review.effort` to `medium`
- **THEN** the model has source `desk` and the effort has source `user`

#### Scenario: Unknown task id
- **WHEN** a user file or desk entry names a task id the table does not have
- **THEN** it warns with the id and has no effect

#### Scenario: Shared value
- **WHEN** a task resolves
- **THEN** the result also holds `shared`, the same resolution without the user layer

### Requirement: Floor and order
Models SHALL be ordered `haiku < sonnet < opus < fable` and efforts `low < medium < high < xhigh < max`. A floor SHALL raise a value below it, per dimension, whichever layer the value came from, and SHALL NOT lower one. Only these model names and efforts SHALL be accepted. Any other model name, including a full model id, `best`, `default`, `opusplan`, `inherit` or a `[1m]` form, SHALL be rejected.

#### Scenario: Floor beats the user
- **WHEN** the floor for `review` is `opus` and `high` and the user sets `sonnet` and `medium`
- **THEN** it resolves to `opus` and `high` with source `floor`, and the entry records the replaced user values

#### Scenario: Floor beats the desk
- **WHEN** the desk sets a value below its own floor
- **THEN** the floor applies

#### Scenario: Above the floor
- **WHEN** the floor for `review` is `opus` and the user sets `fable` and `max`
- **THEN** the user's values stand with source `user`

#### Scenario: Full model id in the user file
- **WHEN** the user file sets a model to `claude-opus-4-5`
- **THEN** that value warns as not one of the accepted names and is ignored

#### Scenario: Limits named
- **WHEN** `CLAUDE_CODE_EFFORT_LEVEL` or `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set in the environment of `desk settings`
- **THEN** it warns that this overrides the resolved value, floor included

### Requirement: Orchestrate uses the resolver
`skills/orchestrate/SKILL.md` SHALL tell the agent to run `desk settings --json` and pass the resolved `model` and `effort` of the task. Its table SHALL hold a stable id per row and machine-readable values, and SHALL stay as the fallback when the command fails, with any `floor` entry in a readable `desk.config.json` raising the fallback value.

#### Scenario: Every row parses
- **WHEN** the table is parsed
- **THEN** every row has a unique id, a `subagent_type`, an accepted model and an accepted effort

#### Scenario: Fallback stated
- **WHEN** the skill text is read
- **THEN** it names `desk settings --json`, the table as the fallback, and the floor for that fallback

#### Scenario: Outside orchestrate
- **WHEN** an agent is started without going through the skill
- **THEN** the resolver has no effect on it, and README and `desk settings` say so

### Requirement: Skills keep user values out of todos
`skills/kickoff/SKILL.md` and `skills/handoff/SKILL.md` SHALL tell the agent to record a task's `shared` values, never its resolved values, in `todo.jsonl`, and `skills/orchestrate/SKILL.md` SHALL tell it to pass the resolved values at spawn, not a todo's.

#### Scenario: Kickoff text
- **WHEN** the kickoff skill text is read
- **THEN** its `--model` step names the `shared` value

### Requirement: The verdict records the review model
`agents/reviewer.md` and `agents/verifier.md` SHALL post a verdict as `<VERDICT> @<sha> by <model>/<effort>`, using the model and effort their brief states, and `by <model>` alone if the brief gives no effort. `skills/orchestrate/SKILL.md` SHALL make the brief state both, and the `desk stream` task text SHALL lead to the same result.

#### Scenario: Merge gate
- **WHEN** the board verdict is `MERGE @<sha> by sonnet/medium` for the branch head
- **THEN** `desk wt merge` accepts it as `MERGE @<sha>`

#### Scenario: Pane colour
- **WHEN** the pane colours a verdict that carries the `by` part
- **THEN** it gets the same colour as the verdict without it

#### Scenario: Stream text
- **WHEN** the `desk stream` task text is read
- **THEN** it says the `reviewer` and `verifier` brief states the model and effort, so the verdict reads `<VERDICT> @<sha> by <model>/<effort>`

### Requirement: The verdict record stays out of git
`skills/handoff/SKILL.md` SHALL tell the agent to quote a verdict in a todo's `--state` without the `by` part, because `todo.jsonl` is committed and `board.jsonl` is not. The README SHALL say the record reaches only people who can read that desk's board.

#### Scenario: Handoff text
- **WHEN** the handoff skill text is read
- **THEN** it says to quote a verdict in `--state` as `<VERDICT> @<sha>`, without its `by <model>/<effort>` part
