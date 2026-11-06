## MODIFIED Requirements

### Requirement: Floor and order
Models SHALL be ordered `haiku < sonnet < opus < fable` and efforts `low < medium < high < xhigh < max`. A floor SHALL raise a value below it, per dimension, whichever layer the value came from, and SHALL NOT lower one. Only these model names and efforts SHALL be accepted. Any other model name, including a full model id, `best`, `default`, `opusplan`, `inherit` or a `[1m]` form, SHALL be rejected. The entry SHALL record the replaced value only for a dimension the user file set.

#### Scenario: Floor beats the user
- **WHEN** the floor for `review` is `opus` and `high` and the user sets `sonnet` and `medium`
- **THEN** it resolves to `opus` and `high` with source `floor`, and the entry records the replaced user values

#### Scenario: Floor beats the desk
- **WHEN** the desk sets a value below its own floor
- **THEN** the floor applies and no replaced user value is recorded

#### Scenario: Above the floor
- **WHEN** the floor for `review` is `opus` and the user sets `fable` and `max`
- **THEN** the user's values stand with source `user`

#### Scenario: Full model id in the user file
- **WHEN** the user file sets a model to `claude-opus-4-5`
- **THEN** that value warns as not one of the accepted names and is ignored

#### Scenario: Limits named
- **WHEN** `CLAUDE_CODE_EFFORT_LEVEL` or `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set in the environment of `desk settings`
- **THEN** it warns that this overrides the resolved value, floor included
