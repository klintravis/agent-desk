## Why

The plugin's three session surfaces show bare numbers. The status line packs warm-hold text, quota,
context and cache into one ` · ` string. The band only counts decisions. The Desk pane is the
`desk status` text with the meter strings above it. The owner asked for the best-practice, simple
version (T-49): bars with the number beside them, the session's running agents, worktrees, decisions,
the output style, and a keep-warm toggle. The pane gets the desk state by parsing status text
(`waiting()` and the `## Claims` lines), which breaks whenever a heading changes. The owner added
`desk status --json` to this change so the pane reads data instead.

## What Changes

- **Status line** (`$.ui.status`, plain text): `ctx ▰▰▰▱▱▱▱▱ 42% · 5h ▰▱▱▱ 31% · warm auto · ⚑ 1`.
  Glyph bars, always with the percent next to them. The quota slot shows the 5h window, or the first
  window when there is no 5h. `warm auto|off` and `⚑ <n>` appear in a desk only, and `⚑` only when
  n > 0. The cache meter moves to the pane. The warm-hold "why" text moves to the pane's Warm row.
- **Band above the prompt**, shown only when there is something to act on and no survey is up:
  `⚑ <n> decision(s) waiting` with a `/decide` Button, and, at 80% context or more,
  `ctx <bar> <pct>%  near full: handoff or /compact`. The near-full hint leaves the status line.
- **Desk pane** rows: Context (bar, percent, used/window, coloured green/orange/red), Quota (bars,
  reset, forecast), Cache (`<n>% hit`), Style (output style name, or `default`), Warm (auto/off Button
  plus why), Agents (running or pending: type · description · age), Trees (claims), Decide (waiting
  decisions plus a `/decide` Button). Below them comes `── desk status ──` and the status text as today.
- **Keep-warm toggle**: auto ↔ off, for this session only, kept in a `$.state` atom, never in
  `$.store`. Only the Warm Button's `onPress` writes it. While it is off, warm-hold neither pings nor
  arms, and the cold-send warning drops its "Warm-hold arms" sentence.
- **`desk status --json`**: one JSON object holding the same sections as the text, built from the same
  data, plus the rendered `text`. The text output stays unchanged and remains the default. A new
  `schemas/desk-status.schema.json` describes it. The pane runs `--json` and drops `waiting()` and
  the text parsing.
- Outside a desk, the status line keeps its context and quota slots in the new bar format. There is
  still no warm slot, no `⚑` and no pane. The band shows only its near-full row.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-ui`: status line, quota/context/cache meters, Desk pane, decisions band. New: meter bars,
  keep-warm toggle.
- `cold-cache-guard`: warm-hold reports its state to the pane Warm row, not the status line, and is
  silent while the toggle is off.
- `desk-cli`: new `desk status --json`.

## Impact

- `hooks/meters.ts`, `hooks/quota.ts`, `hooks/warmhold.ts`, `hooks/register.ts`, `hooks/pane.tsx`, and
  their tests `hooks/*.test.ts(x)`.
- `bin/desk.mjs` (`statusData`, `statusText` on top of it, `--json`), `lib/schema.mjs` (`schemaTest`
  also walks the new schema), `schemas/desk-status.schema.json`, and `test/desk.test.mjs`.
- `types/index.d.ts`: new atoms and shape bumps.
- README (Session meters, Warm-hold, Desk pane, Status watch / Commands), CHANGELOG,
  `openspec/inventory.md`.
- No new config, env var or dependency.
