## 1. desk status --json (bin/desk.mjs, schema)

- [x] 1.1 Split `statusText` (bin/desk.mjs:418) into `statusData(input)`, which returns the object in design.md "desk status --json", and a formatter. `statusText(input)` keeps its signature and formats `statusData(input)`. Check: `node bin/desk.mjs status --self-test` passes with `statusTest` unedited (`git diff bin/desk.mjs` shows no change inside `statusTest`).
- [x] 1.2 In `status(argv)` (bin/desk.mjs:611), keep `--self-test` and `--watch` first. Then `--json` writes `JSON.stringify({ ...statusData(g), text: statusText(g) }) + '\n'` from one `gatherStatus()`. Update the usage line (bin/desk.mjs:5) to `desk status [--watch|--json]`.
- [x] 1.3 Add `schemas/desk-status.schema.json` (draft 2020-12, `title`, `description`, `v: {const: 1}`, top-level `additionalProperties: false`, nullable fields as `type: [..., "null"]`). Use only the keywords `lib/schema.mjs` supports. Do not add it to `SCHEMAS`. Add it to `schemaTest`'s walk (lib/schema.mjs:71), with one valid and one invalid sample. Check: `node bin/desk.mjs --self-test` passes, and `grep -n "desk-status" lib/schema.mjs` shows the walk but no `SCHEMAS` entry.
- [x] 1.4 Test in `test/desk.test.mjs`, `status --json validates against desk-status schema`. On a tmp desk with one owner todo and one claim: stdout parses; `validate(schema('desk-status'), obj)` is `[]`; `obj.decisions` and `obj.claims` hold that todo and that claim; and `obj.text` minus its first line equals `desk status` stdout minus its first line.

## 2. Bars and meters (hooks/meters.ts, hooks/quota.ts)

- [x] 2.1 Add `export function bar(pct, width)` to meters.ts, as described in design.md "Bar helper". Test `bar: rounds to the nearest cell and clamps`, covering 0/8, 42/8 → `▰▰▰▱▱▱▱▱`, 42/10, 50/4, 100/8, -5/8 and 130/8 (length always equals the width).
- [x] 2.2 `meter()` keeps numbers: ctx `{ pct, tokens, window }`, the cache pct and the quota windows. `paint()` builds the status line slots `[ctx, quota, warm, flag]`, as in the plugin-ui "One status line" spec. It drops `line.hold` and `line.cache` from the line, and drops the near-full hint. Rename or replace the `line` record to hold `flag` and `warm` too.
- [x] 2.3 Pane formats: Context `<bar10> <pct>%  <used>/<window>`; Cache `<n>% hit`; Quota windows `<name> <bar10> <pct>%`, with the first carrying ` · resets <d>`, then the existing forecast. Update `hooks/meters.test.ts` ('cache: …' expects `50% hit` style; 'ctx: …' expects bar and percent, with no hint string) and `hooks/quota.test.ts` (expected strings carry bars). `paint()` writes the meters atom in every session, not only in a desk, so the band's ctx row works outside a desk. Checks: `grep -n "near full" hooks/meters.ts` prints nothing, and `grep -n "near full: handoff or /compact" hooks/pane.tsx` prints the band row.

## 3. Keep-warm toggle (hooks/warmhold.ts, hooks/register.ts)

- [x] 3.1 Add `off: () => Promise<boolean>` to `Deps`. While it is off, `tick` resets the hold as when idle, calls `status(undefined)`, never forks, and returns `'idle'`. Tests: `warmhold: off resets the hold and never pings` (agents running, cache 55m old, off → no fork, `'idle'`), and `warmhold: back to auto starts counting afresh`.
- [x] 3.2 `coldSend` takes an `off` flag that drops ` Warm-hold arms for 3h once it lands.` In register.ts, when off: skip arming after a cold write (zero `armedUntil` after `mainTurn`) and skip the "warm-hold armed" log (register.ts:88). The cold warning still logs. Test: `warmhold: cold warning without the arming sentence when off`.
- [x] 3.3 Add the `warm` atom `{ off: boolean; why?: string }` (default `{ off: false }`) in `$.state`. `Deps.off` reads it. `Deps.status` writes `why` with `update`, outside render. Nothing writes it to `$.store`. Check: `grep -n "store" hooks/pane.tsx hooks/register.ts` shows no `warm` key.

## 4. Agents and style (hooks/register.ts)

- [x] 4.1 In the desk tick, call `$.agent.list()` once. Write the `agents` atom `[{ id, type, description, status, since }]` for running or pending agents, keeping `since` per id from the previous value, else now. `Deps.active` counts the same list. Add the comment `shortcut: age is first-seen on the minute tick; switch to agent.spawn if AgentInfo never gains a start time`. Test: `pane: agents keep their first-seen time across ticks`.
- [x] 4.2 Add a pass-through `prompt.compose` hook. It returns `next(e)` unchanged. When `e.traits` has neither `teammate` nor `analysis`, it writes the `style` atom as `e.outputStyle?.name ?? null`, only when the value changed. Test: `register: compose records the output style and leaves the result unchanged`.

## 5. Pane and band (hooks/pane.tsx, types)

- [x] 5.1 `refresh` runs `desk status --json` and stores the parsed object in `status`. On a parse failure it keeps the last good value and shows stderr or `desk status failed: <error>`. Delete `waiting()` and all parsing of status text. Check: `grep -n "waiting(\|## Claims\|## Owner decisions" hooks/pane.tsx` prints nothing.
- [x] 5.2 Pane rows, in order: Context (coloured: `green` under 60, `orange` from 60 to 79, `red` from 80), Quota, Cache, Style (`default` when null), Warm (a Button labelled with the mode, whose `onPress` flips `warm.off` with `update`, then the dim why), Agents (`<type> · <description> · <durationOf(age)>`, or `none`), Trees (from `claims`), Decide (from `decisions`, plus a `/decide` Button, or `none`). Then `── desk status ──` and the `text` lines, with `#` lines bold. A row with an unknown value is left out. Tests: `pane: warm toggle flips from onPress` (press → `off`, the status line shows `warm off`; no write during render), and `pane: rows read the status JSON` (Trees and Decide from a mocked `--json`).
- [x] 5.3 The band shows `⚑ <n> decision(s) waiting` and a `/decide` Button (`onPress` runs `/decide` through `$.command.run`; check the argument shape in the types) when `decisions.length > 0`. It shows the ctx near-full row from 80% in any session, desk or not, from the meters atom. It still yields to `hasSurvey`. The pane refresh sets the status line `⚑` from `decisions.length`. Replace the test 'the band counts waiting owner decisions and hides at none' with `pane: band shows decisions and near-full, hides when neither`, plus `pane: outside a desk the band shows only near-full`. Update the other pane tests ('an interactive session opens the pane…', 'in a desk the meters head the pane') to mock `--json`.
- [x] 5.4 `types/index.d.ts`: `DeskStatus` becomes the JSON object type (shape `status-2`) and `DeskMeters` the numbers object (shape `meters-2`). Add `warm`, `style` and `agents` to the `'agent-desk'` PluginState. Check: `claude plugin test` passes (the repo has no tsconfig; the plugin test loads the TS).

## 6. Docs and check

- [x] 6.1 README:
  - Session meters: the new status line, with bars, warm and ⚑; cache and the hint moved.
  - Warm-hold: the auto/off toggle, for the session only; its state now in the pane Warm row.
  - Desk pane: the rows and the band.
  - Commands / Status watch: `desk status --json` and the schema.
- [x] 6.2 CHANGELOG `## Unreleased`: one line each for the status line with bars, the band rows, the pane rows, the keep-warm toggle, and `desk status --json` with `schemas/desk-status.schema.json`.
- [x] 6.3 `openspec/inventory.md`:
  - the `desk status --json` flag;
  - the `desk-status` schema row;
  - the new pane rows, atoms and toggle;
  - the warm-hold status moving to the pane.

  Check: `package.json` `files` already ships `schemas/`.
- [x] 6.4 Run `npm test && claude plugin test && claude plugin validate .`, which must exit 0. Run the name check before the push.
