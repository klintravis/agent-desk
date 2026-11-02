## Why

Agents in a desk should answer tersely by default, and the mod meter showed a dollar amount although cost differs by plan (API, subscription, enterprise contract) (T-35).

## What Changes

- New `desk.config.json` key `outputStyle` (default `"Concise"`, `""` = leave alone). `desk sync` writes it as `outputStyle` into every `.claude/settings.local.json` it writes, so main and headless sessions run in that style. An empty value is not written; a key written earlier stays.
- Output styles do not reach subagents: for `SubagentStart` with style `Concise`, `subagent-context.mjs` adds one rule line asking for concise replies.
- The mod meter drops the dollar amount: `$1.23 · cache 94%` becomes `cache 94%` (`costLine` becomes `cacheLine`). `desk stream --budget` is unchanged.

## Capabilities

### Modified Capabilities
- `desk-config`: requirement `Top-level keys and defaults` (`outputStyle`, type check).
- `desk-sync`: requirement `Claude settings per checkout` (`outputStyle`).
- `session-context`: new requirement `Concise reply rule for subagents`.
- `plugin-ui`: requirements `One status line` and `Cost and cache meter` (renamed `Cache meter`).

## Impact

`lib/config.mjs`, `lib/sync.mjs`, `scripts/subagent-context.mjs`, `hooks/meters.ts`, README, inventory, CHANGELOG. The cost figure disappears from the meter; a desk that wants the old style sets `"outputStyle": ""`.
