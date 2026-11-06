## Why

Warm-hold counted its 4-hour cap from when the hold began, so an active session lost its hold 4 hours in even while the owner was working in it (ruling T-216, todo T-226).

## What Changes

- A main-session request restarts the 4-hour cap clock. Pings do not: a ping is an engine fork (its `turn.step` carries an `agentId`, which the handler skips) and `tick` sets `lastMainAt` itself, so a hold kept up by pings alone still stops at 4 hours.

## Capabilities

### Modified Capabilities
- `cold-cache-guard`: the Cap scenario of "Warm-hold stops".
