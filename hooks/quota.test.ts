import { expect, test } from 'claude-code/testing'

import { addSample, burnOf, durationOf, quotaLine, quotaOf, samplesOf, windowMsOf } from './quota'

const H = 3600e3
const at = (h: number, pct: number, resetsAt = '2026-11-01T05:00:00Z') => ({ atMs: h * H, percentUsed: pct, resetsAt })

test('samples: a moved reset or a fallen percent starts a new window; junk is dropped', () => {
  const w = windowMsOf('five_hour')
  let s = addSample([], at(0, 10), w)
  s = addSample(s, at(1, 30), w)
  expect(s.length).toBe(2)
  expect(addSample(s, at(2, 5), w).length).toBe(1)
  expect(addSample(s, at(2, 40, '2026-11-01T10:00:00Z'), w).length).toBe(1)
  expect(samplesOf({ five_hour: [at(0, 1), { atMs: 'x' }], bad: 3 })).toEqual({ five_hour: [at(0, 1)] })
})

test('burn: none until the samples span a twentieth of the window, then percent per hour', () => {
  expect(burnOf([at(0, 10), at(0.1, 20)], 5 * H)).toBe(null)
  expect(burnOf([at(0, 10), at(1, 30)], 5 * H)).toBe(20)
})

test('the line: usage, reset countdown, and the window that fills before it resets', () => {
  const now = Date.parse('2026-11-01T02:00:00Z')
  const limits = [{ kind: 'seven_day', percentUsed: 18 }, { kind: 'five_hour', percentUsed: 40.000000001, resetsAt: '2026-11-01T05:00:00Z' }]
  const s = { five_hour: [{ atMs: now - H, percentUsed: 20 }, { atMs: now, percentUsed: 40 }] }
  const line = (x: Parameters<typeof quotaOf>[1]) => quotaLine(quotaOf(limits, x, now)!)
  expect(line(s)).toBe('5h ▰▰▰▰▱▱▱▱▱▱ 40% · resets 3h00m · 7d ▰▰▱▱▱▱▱▱▱▱ 18% · nothing hits 100% before reset') // full exactly at reset
  const fast = { five_hour: [{ atMs: now - H, percentUsed: 10 }, { atMs: now, percentUsed: 40 }] }
  expect(line(fast)).toBe('5h ▰▰▰▰▱▱▱▱▱▱ 40% · resets 3h00m · 7d ▰▰▱▱▱▱▱▱▱▱ 18% · 5h full in ~2h00m')
  expect(line({})).toContain('collecting burn rate')
  expect(quotaOf([], {}, now)).toBe(undefined)
  expect(durationOf(26 * H)).toBe('1d 2h')
})

test('the status line carries the quota after a turn, outside a desk too', async ($, on) => {
  const shown: (string | undefined)[] = []
  const stored: Record<string, unknown> = {}
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: () => {} }))
  on('clock.now', () => ({ value: Date.parse('2026-11-01T02:00:00Z') }))
  on('store.get', (_$, e) => ({ value: stored[e.key] }))
  on('store.set', (_$, e) => { stored[e.key] = e.value; return { value: undefined } })
  on('ui.status', (_$, e) => { shown.push(e.text); return { value: undefined } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-11-01T04:00:00Z' }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 't' } as never)
  expect(shown.at(-1)).toBe('ctx ▱▱▱▱▱▱▱▱ 1% · 5h ▰▰▱▱ 42%')
  expect(Object.keys(stored)).toEqual(['quota-samples'])
})
