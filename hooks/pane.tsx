import { atom, read, update } from 'claude-code'
import type { Engine, On } from 'claude-code'

import type { AgentRow, DeskMeters, DeskStatus, WarmState } from '../types'
import { bar, cacheLine, ctxLine, CTX_HINT, line, paint } from './meters'
import { durationOf, quotaLine } from './quota'

// The desk pane: session rows, then `desk status` (--json), refreshed every minute, beside the chat in
// interactive sessions, or once a surface attaches. The band above the prompt counts the owner decisions in that same status and
// warns near a full context (any session); /decide runs `desk decide`.
// The CLI is this plugin's own bin/desk.mjs; it finds the desk by DESK_HOME (desk sync sets it in each
// checkout's settings) or by walking up from the session's folder to desk.config.json.
export const PANE = 'desk-status'
export const EVERY = 60_000 // status calls gh; once a minute is plenty
// A declaration, not an arrow: the engine follows $ across a call only into a function declaration.
function desk($: Engine) { return `${$.plugin.root}/bin/desk.mjs` }
// `desk home` exits 0 only inside a desk (DESK_HOME, or desk.config.json at or above the session's folder).
export async function inDesk($: Engine) {
  return $.process.run(['node', desk($), 'home'], { timeoutMs: 15_000 }).then((p) => p.exitCode === 0, () => false)
}
const status = atom({ plugin: 'agent-desk', key: 'status' } as const, null, { shape: 'status-2' })
const err = atom({ plugin: 'agent-desk', key: 'err' } as const, '', { shape: 'err-1' })
// The session's meters as numbers: every surface formats them (status line, band, pane).
const meters = atom({ plugin: 'agent-desk', key: 'meters' } as const, {}, { shape: 'meters-2' })
// Session state, never $.store: keep-warm off must not outlive the session. Only the Warm Button writes `off`.
const warm = atom({ plugin: 'agent-desk', key: 'warm' } as const, { off: false }, { shape: 'warm-1' })
const style = atom({ plugin: 'agent-desk', key: 'style' } as const, null, { shape: 'style-1' })
const agents = atom({ plugin: 'agent-desk', key: 'agents' } as const, [], { shape: 'agents-1' })
export async function showMeters($: Engine, m: DeskMeters) {
  await update($, meters, () => m)
}
// The engine's state scan reads atoms only from the file that declares them, so register.ts goes through these.
export async function warmOff($: Engine) { return (await read($, warm)).off }
export async function setWhy($: Engine, why: string | undefined) { await update($, warm, (w) => (w.why === why ? w : { ...w, why })) }
export async function recordStyle($: Engine, name: string | null) { if (name !== (await read($, style))) await update($, style, () => name) }
// Live agents with the time the minute tick first saw each; returns the count.
export async function trackAgents($: Engine, live: readonly { id: string; type: string; description: string; status: string }[], now: number) {
  const prev = new Map((await read($, agents)).map((a) => [a.id, a.since]))
  await update($, agents, () => live.map((a) => ({ id: a.id, type: a.type, description: a.description, status: a.status, since: prev.get(a.id) ?? now })))
  return live.length
}

async function refresh($: Engine) {
  const p = await $.process.run(['node', desk($), 'status', '--json'], { timeoutMs: 45_000 }).catch((e) => ({ stdout: '', stderr: `desk status failed: ${e}` }))
  let s: DeskStatus | undefined, bad = ''
  try { s = JSON.parse(p.stdout) } catch (e) { bad = p.stderr || `desk status failed: ${e}` }
  if (s) {
    await update($, status, () => s)
    line.flag = s.decisions.length
    paint($)
  }
  await update($, err, () => bad)
}

// Called from register's session.start hook (interactive) or, once a surface attaches, its session.attach hook.
// Idempotent: session.start (interactive) and session.attach (SDK hosts: VS Code, desktop) may both call it.
let started = false
export async function startPane($: Engine, isInteractive: boolean | undefined) {
  if (!isInteractive || started) return
  started = true
  await $.command.register({ name: 'desk', description: 'Open the desk status pane (desk status)' }).catch(() => {})
  await $.command.register({ name: 'decide', description: 'Owner decisions one at a time; /decide T-n <ruling> records one; /decide --list [n] lists rulings', argumentHint: '[T-n <ruling> | --list [n]]' }).catch(() => {})
  $.clock.every(EVERY, () => void refresh($).catch(() => {}))
  void refresh($).catch(() => {})
  void $.ui.open({ id: PANE, title: 'Desk' }).catch(() => {})
}

// A Decide press shows the first waiting decision's options, then leaves `/decide T-n ` in the prompt for the ruling:
// printing the question alone left the owner nothing to press or type into. The id comes from what /decide printed:
// the button's id can be a minute old, and a ruling must land on the question the owner read. A draft is never overwritten.
function ask($: Engine) {
  void $.command.run({ command: 'decide' }).then(async (r) => {
    const id = /^(T-\d+) /.exec(r.text ?? '')?.[1]
    if (id && !(await $.prompt.read()).text.trim()) await $.prompt.fill({ text: `/decide ${id} ` })
  }).catch(() => {})
}
const ago = (now: number, ts: number | string) => durationOf(Math.max(0, now - (typeof ts === 'string' ? Date.parse(ts) : ts)))
const ctxColor = (pct: number) => (pct >= CTX_HINT ? 'red' : pct >= 60 ? 'orange' : 'green')

export function registerPane(on: On) {
  on('command.run', { command: 'desk' }, async ($) => {
    await $.ui.open({ id: PANE, title: 'Desk' })
    return { text: 'Desk pane opened.' }
  })

  // `/decide` shows the next waiting decision; `/decide T-n <ruling>` records it (the ruling is one argv element).
  on('command.run', { command: 'decide' }, async ($, e) => {
    const args = (e.args ?? '').trim()
    const m = /^(T-\d+)\s+([\s\S]+)$/.exec(args)
    const out = await $.process.run(['node', desk($), 'decide', ...(m ? [m[1], m[2]] : args.split(/\s+/).filter(Boolean))], { timeoutMs: 30_000 })
      .then((p) => p.stdout || p.stderr, (err) => `desk decide failed: ${err}`)
    if (m) void refresh($).catch(() => {}) // the band drops the decision now, not at the next minute
    return { text: out.trim() }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const ds = (await read($, status))?.decisions ?? []
    const n = ds.length
    const ctx = (await read($, meters)).ctx
    const near = !!ctx && ctx.pct >= CTX_HINT
    if (e.props.hasSurvey || (!n && !near)) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {n > 0 && (
          <Box>
            <Text color="yellow" bold>⚑ {n} decision{n === 1 ? '' : 's'} waiting </Text>
            <Button key="decide" variant="primary" onPress={() => ask($)}>{`Decide ${ds[0].id}`}</Button>
          </Box>
        )}
        {near && <Text color="red">ctx {bar(ctx.pct, 8)} {ctx.pct}%  near full: handoff or /compact</Text>}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const s = await read($, status)
    const bad = await read($, err)
    const m = await read($, meters)
    const w: WarmState = await read($, warm)
    const style_ = await read($, style)
    const ag: AgentRow[] = await read($, agents)
    const now = await $.clock.now()
    const row = (label: string, ...kids: unknown[]) => <Box key={label}><Text dimColor>{label.padEnd(8)}</Text>{kids as never}</Box>
    // Pressing writes the toggle, then repaints the status line's warm slot; a press is not a render.
    const flip = () => void update($, warm, (x) => ({ ...x, off: !x.off })).then(async () => { line.off = await warmOff($); paint($) }).catch(() => {})
    const why = w.off ? 'off for this session' : w.why?.replace(/^warm-hold: /, '') || 'idle'
    return (
      <Box flexDirection="column">
        {m.ctx && row('Context', <Text color={ctxColor(m.ctx.pct)}>{ctxLine(m.ctx)}</Text>)}
        {m.quota && row('Quota', <Text>{quotaLine(m.quota)}</Text>)}
        {m.cache !== undefined && row('Cache', <Text>{cacheLine(m.cache)}</Text>)}
        {row('Style', <Text>{style_ ?? 'default'}</Text>)}
        {row('Warm', <Button key="warm" onPress={flip}>{w.off ? 'off' : 'auto'}</Button>, <Text dimColor> {why}</Text>)}
        {row('Agents', ag.length ? <Box flexDirection="column">{ag.map((a) => <Text key={a.id}>{a.type} · {a.description} · {ago(now, a.since)}</Text>)}</Box> : <Text dimColor>none</Text>)}
        {s && row('Trees', s.claims.length ? <Box flexDirection="column">{s.claims.map((c) => <Text key={c.slug}>{c.slug} · {c.from} · claimed {ago(now, c.ts)}</Text>)}</Box> : <Text dimColor>none</Text>)}
        {s && row('Decide', s.decisions.length
          ? <Box flexDirection="column">{s.decisions.map((d) => <Text key={d.id}>{d.id} {d.title}</Text>)}<Box><Button key="decide" variant="primary" onPress={() => ask($)}>{`Decide ${s.decisions[0].id}`}</Button></Box></Box>
          : <Text dimColor>none</Text>)}
        <Text dimColor>── desk status ──</Text>
        {!s && <Text dimColor>{bad || 'Loading desk status…'}</Text>}
        {s && bad && <Text color="red">{bad}</Text>}
        {s && s.text.split('\n').filter(Boolean).map((l) => <Text bold={l.startsWith('#')}>{l}</Text>)}
      </Box>
    )
  })
}
