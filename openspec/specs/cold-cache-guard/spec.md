# cold-cache-guard Specification

## Purpose

The main session's prompt cache lives one hour. This guard warns before a send that would rewrite a
big cold cache, and warm-hold keeps the cache warm while agents run or after a cold write. Implemented
in `hooks/warmhold.ts` and wired in `hooks/register.ts`. Active in a desk only.

## Requirements

### Requirement: Cold send warning
Before the user's own send, the plugin SHALL say what a cold cache will cost to rewrite.

#### Scenario: Cold and big
- **WHEN** the last main-session request was 60 minutes or more ago and the context is 50,000 tokens or more
- **THEN** a log line says the cache is cold for `<n>m` and the send re-writes about `<k>k` tokens, about 20x a warm turn's input
- **AND** the send goes through and warm-hold will arm once it lands

#### Scenario: Keep-warm off
- **WHEN** a send is cold and big while keep-warm is `off`
- **THEN** the same warning is logged without the sentence that warm-hold will arm

#### Scenario: Warm or small
- **WHEN** the cache is under 60 minutes old or the context is under 50,000 tokens
- **THEN** nothing is said

#### Scenario: Not the user's send
- **WHEN** the prompt is a slash command or does not come from the composer
- **THEN** the guard does not run

#### Scenario: A resumed session
- **WHEN** a session starts with 50,000 tokens or more already in its context
- **THEN** its cache counts as cold until its first main request

### Requirement: Refuse mode
With `AGENT_DESK_COLD_GUARD=refuse` the guard SHALL drop the first cold send per cold spell.

#### Scenario: First send dropped
- **WHEN** a cold send arrives and `AGENT_DESK_COLD_GUARD` is `refuse`
- **THEN** it is dropped with `Send it again to pay it, or /clear and start from a note`

#### Scenario: Resend goes through
- **WHEN** the same send is repeated before the cache is refreshed
- **THEN** it goes through, with the warning

#### Scenario: Guard failure
- **WHEN** the guard throws
- **THEN** the send goes through unchanged

### Requirement: Arming after a cold write
After a main-session turn that rewrote the cache, warm-hold SHALL stay armed for 3 hours, unless
keep-warm is `off`.

#### Scenario: Flagged send landed
- **WHEN** a send flagged cold completes
- **THEN** warm-hold is armed and a log line reports the write

#### Scenario: Detected write
- **WHEN** a turn started from more than 20,000 tokens of context, wrote at least half of it to the cache and read back less than half
- **THEN** warm-hold is armed

#### Scenario: A big read is not cold
- **WHEN** a turn writes new content but still reads its prefix from the cache
- **THEN** warm-hold is not armed

#### Scenario: Keep-warm off
- **WHEN** a cold write lands while keep-warm is `off`
- **THEN** warm-hold is not armed and no arming line is logged

### Requirement: Warm-hold ping
While keep-warm is `auto`, and warm-hold is armed or the session's agents are pending or running, the
plugin SHALL check once a minute and ping the cache when it is 50 minutes old. Its state SHALL show in
the Desk pane's Warm row, not on the status line.

#### Scenario: Waiting
- **WHEN** the cache is under 50 minutes old
- **THEN** the Warm row says `<why>, ping in <n>m`

#### Scenario: Ping
- **WHEN** the cache is 50 minutes old
- **THEN** a fork asks for the single word `ok`, which reads the prefix and keeps the cache warm for another hour
- **AND** the Warm row says how many tokens were read from the cache

#### Scenario: Idle
- **WHEN** no agent is running and the hold is not armed
- **THEN** the hold resets and the Warm row says `idle`

#### Scenario: Off
- **WHEN** keep-warm is `off`
- **THEN** the hold resets as when idle, no ping is sent, and the Warm row says `off for this session`
- **AND** switching back to `auto` starts counting afresh

### Requirement: Warm-hold stops
Warm-hold SHALL stop, and say why in the Desk pane's Warm row, when holding is pointless or unsafe.

#### Scenario: Cap
- **WHEN** it has held for 4 hours
- **THEN** it stops with `held 240m, the cap`

#### Scenario: Already cold
- **WHEN** the cache is already 60 minutes old
- **THEN** it stops with `cache already cold, nothing to hold`

#### Scenario: Ping failed
- **WHEN** the ping fork is not answered
- **THEN** it stops with `ping failed (<reason>)`

#### Scenario: Cache gone
- **WHEN** the ping wrote to the cache at least a tenth of what it read
- **THEN** it stops with `the ping found the cache gone`

#### Scenario: A main request restarts it
- **WHEN** a main-session request refreshes the cache
- **THEN** the stop reason is cleared and counting starts again
