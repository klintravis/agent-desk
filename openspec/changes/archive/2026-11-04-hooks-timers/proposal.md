## Why

Two timer faults found in an audit (T-210). A warm-hold ping slower than the one-minute tick got a second ping from the next tick, and each extra ping re-reads the whole context. The quota keeps 240 samples at one a minute, under 4 hours, while the 7-day burn rate needs 8.4 hours, so the 7-day rate was never computed.

## What Changes

- Warm-hold sends no new ping while one is still running.
- Quota samples are thinned to window/240 on the newest pair (one reading a minute gives 2-minute samples for 5h and about 42-minute ones for 7d), so 240 samples span the window.
- Not changed: the 4-hour cap still stops the hold despite main traffic (`hooks/warmhold.test.ts` pins that; the spec says "held for 4 hours"). Whether main traffic should reset it is owner decision T-216.

## Capabilities

### Modified Capabilities
- `cold-cache-guard`: "Warm-hold ping" gains a scenario.
- `plugin-ui`: "Quota samples".
