import type { ModelForkResult } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { AUTO_WARM, BIG, COLD_AFTER, MAX_HOLD, PING_AFTER, coldSend, mainRequest, mainTurn, newHold, tick } from './warmhold'

const usage = (read: number, write: number) =>
  ({ input_tokens: 10, output_tokens: 1, cache_read_input_tokens: read, cache_creation_input_tokens: write }) as never

function deps(at: { t: number }, agents: number, reply: ModelForkResult, off = { v: false }) {
  const seen = { pings: 0, status: [] as (string | undefined)[] }
  return {
    seen,
    d: {
      off: async () => off.v,
      now: async () => at.t,
      active: async () => agents,
      fork: async () => { seen.pings++; return reply },
      status: (s: string | undefined) => { seen.status.push(s) },
    },
  }
}
const warm: ModelForkResult = { isAnswered: true, text: 'ok', usage: usage(300_000, 50) }

test('no agents: idle, no ping, status cleared', async () => {
  const at = { t: PING_AFTER + 1 }
  const { d, seen } = deps(at, 0, warm)
  expect(await tick(newHold(0), d)).toBe('idle')
  expect(seen.pings).toBe(0)
  expect(seen.status).toEqual([undefined])
})

test('warmhold: off resets the hold and never pings', async () => {
  const at = { t: 55 * 60e3 }, off = { v: true }
  const { d, seen } = deps(at, 2, warm, off)
  const h = newHold(0)
  h.since = 1; h.stopped = 'x'; h.armedUntil = at.t + 1
  expect(await tick(h, d)).toBe('idle')
  expect([seen.pings, seen.status, h.since, h.stopped, h.armedUntil]).toEqual([0, [undefined], null, null, 0])
})

test('warmhold: back to auto starts counting afresh', async () => {
  const at = { t: 10 * 60e3 }, off = { v: true }
  const { d } = deps(at, 1, warm, off)
  const h = newHold(0)
  await tick(h, d)
  at.t = 12 * 60e3
  off.v = false
  expect(await tick(h, d)).toBe('wait')
  expect(h.since).toBe(12 * 60e3)
})

test('warmhold: cold warning without the arming sentence when off', () => {
  const h = newHold(0)
  expect(coldSend(h, COLD_AFTER + 1, 300_000, false, true)?.text).not.toContain('Warm-hold arms')
  expect(coldSend(newHold(0), COLD_AFTER + 1, 300_000, false)?.text).toContain('Warm-hold arms')
})

test('agents running: waits until 50 min idle, then pings and counts again from the ping', async () => {
  const at = { t: 10 * 60e3 }
  const h = newHold(0)
  const { d, seen } = deps(at, 2, warm)
  expect(await tick(h, d)).toBe('wait')
  at.t = PING_AFTER
  expect(await tick(h, d)).toBe('ping')
  expect(seen.pings).toBe(1)
  at.t = PING_AFTER + 60e3
  expect(await tick(h, d)).toBe('wait') // the ping refreshed the cache
})

test('a ping that had to rewrite the prefix stops the hold until the next main request', async () => {
  const at = { t: PING_AFTER }
  const h = newHold(0)
  const { d, seen } = deps(at, 1, { isAnswered: true, text: 'ok', usage: usage(1000, 300_000) })
  expect(await tick(h, d)).toBe('ping')
  at.t += PING_AFTER
  expect(await tick(h, d)).toBe('stop')
  expect(seen.pings).toBe(1)
  mainRequest(h, at.t)
  at.t += 60e3
  expect(await tick(h, d)).toBe('wait')
})

test('never pings a cache that is already cold, nor past the 4h cap', async () => {
  const at = { t: COLD_AFTER }
  const { d, seen } = deps(at, 1, warm)
  expect(await tick(newHold(0), d)).toBe('stop')
  const h = newHold(0)
  at.t = 1
  await tick(h, d) // hold starts
  at.t = MAX_HOLD + 2
  h.lastMainAt = at.t - 1 // a ping just refreshed the cache (not a main request), but the cap is reached
  expect(await tick(h, d)).toBe('stop')
  expect(seen.pings).toBe(0)
})

test('pings alone hit the 4h cap; a main request restarts it', async () => {
  const at = { t: 1 }
  const { d, seen } = deps(at, 1, warm)
  const h = newHold(0)
  await tick(h, d) // hold starts at t=1
  // Pings keep the cache warm but never reset the cap.
  while (at.t <= MAX_HOLD) { at.t += PING_AFTER; await tick(h, d) }
  expect(h.stopped).toBe('held 240m, the cap')
  const pings = seen.pings
  expect(pings).toBeGreaterThan(3)
  // Main traffic restarts the hold and the cap clock; a full cap later it stops again.
  mainRequest(h, at.t)
  at.t += PING_AFTER
  expect(await tick(h, d)).toBe('ping') // without the restart this would still be 'stop'
  while (!h.stopped) { at.t += PING_AFTER; await tick(h, d) }
  expect(seen.pings).toBeGreaterThan(pings + 3)
  expect(h.stopped).toBe('held 240m, the cap')
})

test('a failed ping stops quietly', async () => {
  const { d } = deps({ t: PING_AFTER }, 1, { isAnswered: false, reason: 'empty-reply' } as ModelForkResult)
  const h = newHold(0)
  expect(await tick(h, d)).toBe('ping')
  expect(h.stopped).toContain('empty-reply')
})

test('cold guard: warns by default, refuse drops only the first send per cold spell', () => {
  const h = newHold(0)
  expect(coldSend(h, COLD_AFTER - 1, 300_000, false)).toBe(null) // still warm
  expect(coldSend(h, COLD_AFTER + 1, BIG - 1, false)).toBe(null) // small context: cheap to rewrite
  const warn = coldSend(h, COLD_AFTER + 5 * 60e3, 330_000, false)
  expect(warn?.drop).toBe(false)
  expect(warn?.text).toContain('re-writes ~330k tokens')
  expect(h.coldPending).toBe(true)
  const r = newHold(0)
  expect(coldSend(r, COLD_AFTER, 330_000, true)?.drop).toBe(true)
  expect(r.coldPending).toBe(false)
  expect(coldSend(r, COLD_AFTER + 1, 330_000, true)?.drop).toBe(false) // the resend goes through
})

test('in a desk the first cold send is logged, or dropped under AGENT_DESK_COLD_GUARD=refuse', async ($, on) => {
  const at = { t: 0 }, logs: string[] = [], env: Record<string, string> = {}
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: at.t }))
  on('store.get', () => ({ value: undefined }))
  on('env.get', (_$, e) => ({ value: env[e.name] }))
  on('ui.log', (_$, e) => { logs.push(e.text); return { value: undefined } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 330_000, window: 1_000_000, percent: 33 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const send = (text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } } as never)
  at.t = COLD_AFTER + 60e3
  expect(await send('hi')).toEqual({ text: 'hi' })
  expect(logs.at(-1)).toContain('re-writes ~330k tokens')
  env.AGENT_DESK_COLD_GUARD = 'refuse'
  expect(((await send('again')) as { drop?: string }).drop).toContain('Send it again')
  expect(await send('again')).toEqual({ text: 'again' })
})

test('a resumed session (context at start) is cold until its first main request, and its first turn arms the hold', () => {
  const h = newHold(1000, 330_000)
  expect(coldSend(h, 1000 + 5 * 60e3, 330_000, false)?.drop).toBe(false) // the first send warns
  expect(mainTurn(newHold(1000, 330_000), 2000, 320_000, 0, 335_000)).toBe(true) // auto-arm needs no flag at send
  mainRequest(h, 2000)
  expect(coldSend(h, 3000, 335_000, false)).toBe(null) // warm from the first request on
  expect(coldSend(newHold(1000), 1000 + 5 * 60e3, 330_000, false)).toBe(null) // a fresh start is warm
})

test('in a desk, a send into a session that started with a big context warns at once', async ($, on) => {
  const logs: string[] = []
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 5 * 60e3 }))
  on('store.get', () => ({ value: undefined }))
  on('env.get', () => ({ value: undefined }))
  on('ui.log', (_$, e) => { logs.push(e.text); return { value: undefined } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 330_000, window: 1_000_000, percent: 33 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  expect(logs.at(-1)).toContain('re-writes ~330k tokens')
})

test('a cold write arms the hold with no agents running; it disarms when the time is up', async () => {
  const h = newHold(0)
  h.ctx = 300_000
  expect(mainTurn(h, 0, 2000, 300_000, 302_000)).toBe(false) // a warm turn writes only its tail
  h.ctx = 302_000
  expect(mainTurn(h, 0, 200_000, 302_000, 502_000)).toBe(false) // a big file read: new content written, prefix still read
  h.ctx = 305_000
  expect(mainTurn(h, 0, 290_000, 0, 305_000)).toBe(true) // the whole prefix rewritten
  const at = { t: PING_AFTER }
  const { d, seen } = deps(at, 0, warm)
  expect(await tick(h, d)).toBe('ping')
  expect(seen.pings).toBe(1)
  at.t = AUTO_WARM + 1
  h.lastMainAt = at.t - 60e3
  expect(await tick(h, d)).toBe('idle')
  expect(h.armedUntil).toBe(0)
})

test('a ping still running at the next tick is not sent twice; a rejected one frees the flag', async () => {
  const at = { t: PING_AFTER }
  let release!: (r: ModelForkResult) => void
  let pings = 0
  const { d: base, seen } = deps(at, 1, warm)
  const d = { ...base, fork: () => { pings++; return new Promise<ModelForkResult>((res) => { release = res }) } }
  const h = newHold(0)
  const first = tick(h, d)
  at.t += 60e3
  expect(await tick(h, d)).toBe('wait')
  expect(pings).toBe(1)
  expect(seen.status.at(-1)).toBe('warm-hold: pinging')
  release(warm)
  expect(await first).toBe('ping')
  expect(h.pinging).toBe(false)
  at.t += PING_AFTER
  expect(await tick(h, { ...d, fork: () => Promise.reject(new Error('boom')) })).toBe('ping')
  expect([h.pinging, h.stopped]).toEqual([false, 'ping failed (Error: boom)'])
})
