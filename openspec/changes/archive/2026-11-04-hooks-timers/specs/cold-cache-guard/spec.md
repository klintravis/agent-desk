## MODIFIED Requirements

### Requirement: Warm-hold ping
While keep-warm is `auto`, and warm-hold is armed or the session's agents are pending or running, the
plugin SHALL check once a minute and ping the cache when it is 50 minutes old, and SHALL NOT start a
ping while the previous one is still running. Its state SHALL show in the Desk pane's Warm row, not on
the status line.

#### Scenario: Waiting
- **WHEN** the cache is under 50 minutes old
- **THEN** the Warm row says `<why>, ping in <n>m`

#### Scenario: Ping
- **WHEN** the cache is 50 minutes old
- **THEN** a fork asks for the single word `ok`, which reads the prefix and keeps the cache warm for another hour
- **AND** the Warm row says how many tokens were read from the cache

#### Scenario: Slow ping
- **WHEN** a ping is still running at the next check
- **THEN** no second ping is sent; a ping that fails frees the next check to ping again

#### Scenario: Idle
- **WHEN** no agent is running and the hold is not armed
- **THEN** the hold resets and the Warm row says `idle`

#### Scenario: Off
- **WHEN** keep-warm is `off`
- **THEN** the hold resets as when idle, no ping is sent, and the Warm row says `off for this session`
- **AND** switching back to `auto` starts counting afresh
