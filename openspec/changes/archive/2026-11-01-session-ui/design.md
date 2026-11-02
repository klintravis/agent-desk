## Context

The current surfaces:
- `hooks/meters.ts` keeps a `line` record (`hold`, `quota`, `ctx`, `cache`). `paint()` joins it into
  `$.ui.status` and pushes the meter strings to the pane's `meters` atom.
- `hooks/quota.ts` `quotaLine` builds the quota text: windows, reset and forecast.
- `hooks/warmhold.ts` `tick` decides idle, wait, ping or stop, and writes its text through
  `Deps.status`, which goes to `line.hold`.
- `hooks/pane.tsx` runs `desk status` (text) every minute into the `status` atom. It counts decisions
  with `waiting()` for the AbovePrompt band and draws the pane as meter lines plus the status text.

The layout was approved by the owner and is not reopened here (T-49). The glyph counts in the
owner's sketch are illustrative: the rounding rule below fixes them.

Engine facts this design rests on (types `claude-code.d.ts`, engine 2.1.314):
- `$.ui.status` takes a string, so the status line has no colour, only glyphs.
- The `Text` `color` enum includes `green`, `orange` and `red`.
- `Button` takes `onPress`. A band Button may take `hotkey`; this change adds none.
- `$.agent.list()` returns `AgentInfo` with `id, teammateId, description, type, status, parentId,
  spawnedBy, name`. **There is no start or spawn time.**
- The output style exists only as `PromptComposeInput.outputStyle` (`{ name, … } | null`). There is
  no session getter. `PromptComposeInput` carries **no agent id**. Its `traits` include `teammate`
  (a teammate's render) and `analysis` (`/context`, which sends nothing).
- `$.state` atoms are session-scoped: the host holds them for the session. `$.store` persists across
  sessions. A write during render is refused.

## Goals / Non-Goals

**Goals:**
- One bar helper.
- The status line, band and pane exactly as laid out.
- An auto/off keep-warm toggle for the session.
- `desk status --json` from the same data as the text, with the pane reading it.

**Non-Goals:**
- New config, env vars, hotkeys or colour themes.
- A JSONL status stream: JSONL stays for the append logs.
- Changing the text of `desk status`.
- Changing what warm-hold decides.
- Colour on the status line, which the engine cannot draw.

## Decisions

### Bar helper
Add `bar(pct, width)` in `meters.ts`. It clamps `pct` to 0..100, then returns
`'▰'.repeat(f) + '▱'.repeat(width - f)` with `f = Math.round(pct / 100 * width)`.

Widths:
- status line: ctx 8, quota 4;
- band: ctx 8;
- pane: 10.

The percent always follows the bar, so colour and glyphs are never the only signal. `bar` gets its
own test: 0, 42/8 → 3, 42/10 → 4, 100, -5 and 130 clamp, 50/4 → 2. *Alternative:* floor or ceil.
Round gives the nearest cell and is symmetric.

### One reading, three renderings
`meter()` keeps reading `$.session.usage()` once a minute and after each turn. It keeps numbers, not
strings: ctx `{ pct, tokens, window }`, the quota rows that `quotaLine` already computes, and the cache
ratio. Each surface formats them:

| Surface | Format |
|---|---|
| status line | `ctx <bar8> <pct>%`, `<name> <bar4> <pct>%` (5h, else the first window in `ORDER`) |
| pane Context | `<bar10> <pct>%  <used>/<window>` |
| pane Quota | each window `<name> <bar10> <pct>%`, the first with ` · resets <d>`, then the existing forecast tail. |
| pane Cache | `<n>% hit` |

`ctxLine` / `cacheLine` / `quotaLine` change their strings to these. Their tests change with them.

### Quota forecast stays, in the pane
The pane Quota row keeps the forecast tail (`5h full in ~…`, `collecting burn rate`,
`nothing hits 100% before reset`), and with it the quota-samples store key, because the code exists
and is tested. The status line drops it. *Alternative:* delete the forecast and the samples. That is
less code, but it removes a feature the owner did not ask to remove. The window label stays `7d`:
the code, README and spec already use it. The owner's sketch wrote `wk`.

### Context colour
The pane Context `Text` is `green` under 60, `orange` from 60 to 79, and `red` from 80 (`CTX_HINT`).
Colour is on Context only, as laid out.

### Status line slots
`paint()` builds `[ctx, quota, warm, flag]` and joins them with ` · `. It clears the line when all are
empty.
- `warm` is `warm auto` or `warm off`, in a desk only.
- `flag` is `⚑ <n>` in a desk when n > 0. n comes from the last status JSON's `decisions.length`, which
  the pane refresh sets into `line.flag`.
- The warm-hold "why" leaves the status line.

### Band
The band renders when there is no survey and at least one of these holds:
- decisions waiting is above 0: Row `⚑ <n> decision(s) waiting` plus `<Button onPress={run /decide}>/decide</Button>`;
- ctx is 80% or more: Row `ctx <bar8> <pct>%  near full: handoff or /compact`.

When neither holds, it returns `next(e)`.

The AbovePrompt render is registered in every session, as today (`registerPane` runs unconditionally;
only its data is desk-only). The decisions row needs the status JSON, so it shows in a desk only. The
ctx row reads the meters, so it shows in any session. That keeps today's near-full hint outside a
desk, now in the band instead of the status line. `paint()` therefore writes the meters atom in every
session, not only in a desk.

The Button calls `$.command.run` for `decide` with no arguments, the same as typing `/decide`. The
implementer checks the `command.run` argument shape in the types.

### Desk pane rows
Each row is a label column (8 wide) and a value. A row whose value is unknown is left out: no ctx
before the first response, no quota without limits, no cache before the first turn.

| Label | Value |
|---|---|
| Context | bar, percent and used/window, coloured |
| Quota | as above |
| Cache | `<n>% hit` |
| Style | the `style` atom, or `default` when it is null |
| Warm | Button labelled with the current mode (`auto` / `off`); `onPress` flips the `warm` atom. Then the why text, dim: the warm-hold text without its `warm-hold: ` prefix while auto; `idle` when there is nothing to hold; `off for this session` when off |
| Agents | one line per agent with status running or pending: `<type> · <description> · <age>`; `none` when there are none |
| Trees | from the status JSON `claims`: `<slug> · <from> · claimed <age>`; `none` when there are none |
| Decide | from the status JSON `decisions`: `<id> <title>` per line, then a `/decide` Button; `none` and no Button when nothing waits |

Then a `── desk status ──` divider and the JSON's `text` lines, with `#` lines bold, as today. Until the
first JSON arrives, the status-based rows and the text show `Loading desk status…`. A failed run or an
unparsable JSON shows the stderr or `desk status failed: <error>` in their place.

### Agents and their age (engine gap)
`AgentInfo` has no start time. Warm-hold's minute tick in `register.ts` already calls `$.agent.list()`,
for `Deps.active`. That one call now also writes an `agents` atom:

`[{ id, type, description, status, since }]`

Rules:
- `since` is the previous `since` for the same id, else now.
- An id that is no longer listed drops out.
- `Deps.active` counts the running or pending agents from the same list.

Age is therefore "first seen" with minute precision, formatted with `durationOf`. It is at most a
minute late, and an agent spawned before a plugin reload restarts at 0.

*Alternative:* an `agent.spawn` hook that records the exact time. That is one more hook, and it still
misses agents spawned before load. Shortcut comment: `shortcut: age is first-seen on the minute tick;
switch to agent.spawn if AgentInfo never gains a start time`.

The tick runs in desk sessions only. That is fine, because the pane is desk-only too.

### Output style (engine gap)
A pass-through `prompt.compose` hook in `register.ts`:

```ts
const r = await next(e)
if (!traits∩{teammate, analysis}) set style atom to e.outputStyle?.name ?? null, when it changed
return r
```

A hook write is not a render write, so it is allowed. The hook never changes the result.

Known limitation: the input has no agent id, so a compose that is not the main loop's cannot be told
apart except by those traits. If subagent requests also fire `prompt.compose` with `outputStyle: null`,
the Style row can flip to `default` until the next main request. That is acceptable for a display row.
The reviewer checks it live (a watch todo).

### Keep-warm toggle
Atom `warm`: `{ off: boolean; why?: string }`, default `{ off: false }`, in `$.state`.

**Writers.** Only the Warm Button's `onPress` writes `off`, via `update`. Warm-hold's `Deps.status`
writes `why`, from the tick and not from a render.

**Session scope.** It is never `$.store`, so `off` never leaks into a later session.

**Reads.**
- `Deps` gains `off: () => Promise<boolean>`. While off, `tick` resets the hold as idle does (`since`,
  `stopped` and `armedUntil` cleared), clears the status, never pings, and returns `'idle'`. Switching
  back to auto therefore starts fresh.
- `register.ts` skips arming after a cold write while off: `mainTurn` is still called for the clock,
  then `armedUntil` is zeroed, and there is no "warm-hold armed" log.
- `coldSend` gets an `off` flag that drops the ` Warm-hold arms for 3h once it lands.` sentence.
  The cold warning itself still shows: it is the guard, not the hold.

### `desk status --json`
Split `bin/desk.mjs`:
- `statusData(input)` returns the object.
- `statusText(input)` formats `statusData(input)`. Its signature does not change, so the existing
  `statusTest` cases pass unedited. That proves the text is byte-identical.
- `status --json` prints `JSON.stringify({ ...statusData(g), text: statusText(g) })` and a newline.
  `--watch` keeps priority.

Object fields (`v: 1`):

| Field | Content |
|---|---|
| `at` | ISO time |
| `decisions` | `[{ id, title }]`, from `ownerWaiting(t)`, the set `ownerOpen` formats |
| `active` | `[todo]`, the folded todo fields (`id`, `title`, `status`, and optional `owner`, `area`, `size`, `prio`, `change`, `tasks`, `slug`, `model`, `state`, `next`) |
| `claims` | `[{ slug, from, ts, last }]`; `last` is the session's last post ts, or null |
| `sessions` | `[{ session, agents: [string] }]`, or null when unavailable |
| `roots` | `[{ id, kind, path, gh?, defaultBranch?, sha? }]` |
| `branches` | `[{ slug, head, ci, verdict, behind }]`. `ci` is the phrase the text shows (`CI -`, `CI unavailable`, `no CI run`, `CI <sha7> <state>[ (not the head)]`). `verdict` is a string or null. `behind` is `{ base, n }` or null |
| `prs` | `[{ slug, number, decision, comments, unresolved, sinceHead }]`, or null when no lookup ran (the text then has no section) |
| `overlaps` | `[string]`, or null when unavailable |
| `tokens` | `{ calls, fresh, cached, out }` (raw numbers), or null when unavailable |
| `text` | the text screen, byte for byte what `desk status` prints |

**Why `text` is in the JSON.** The pane still shows the full screen under `── desk status ──`, so it
needs the text. A second `desk status` run would double the `gh` calls. Redrawing every section in
TSX would be a second renderer that can drift from the CLI. `text` comes from `statusText` over the
same input, so it cannot drift. *Alternative:* drop `text` and draw only the structured rows. That
loses CI, verdicts, roots and tokens from the pane.

**Schema.** `schemas/desk-status.schema.json` uses only the keyword subset of `lib/schema.mjs`:
- no `oneOf`, `$ref` or `minimum`;
- nullable fields use `"type": ["array", "null"]` (or `object`);
- `additionalProperties: false` at the top, and open on todo items, as in `todo.schema.json`'s `set`.

It is **not** added to `SCHEMAS`: that map drives `deskFileWarnings`, which looks for a desk file by
that name. `schemaTest` walks it too, so an unsupported keyword still throws.

### Pane reads the JSON
`refresh` runs `desk status --json` and parses stdout into the `status` atom (object), whose shape
bumps to `status-2`. A parse failure keeps the previous good value and shows the error.
- `waiting()` is deleted. The band and `line.flag` use `decisions.length`.
- `meters` becomes the numbers object (`meters-2`), and the pane formats it.
- New atoms: `warm`, `style`, `agents`.

## Risks / Trade-offs

- [Style can read `default` falsely if non-main composes fire] → Shown only in the pane. A watch todo
  checks it live.
- [Agent age is first-seen, up to a minute late] → Stated as a shortcut.
- [JSON exposes local repo paths and session ids] → The same data the text already prints, read
  locally by the plugin. Nothing new leaves the machine.
- [The status JSON is bigger than the text (it carries both)] → One local call a minute.

## Migration Plan

None for desk files. Atom shape bumps (`status-2`, `meters-2`) make old in-session values read as
absent after a plugin update.

## Open Questions

None. The layout is decided. The engine gaps above have stated fallbacks.
