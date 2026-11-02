import type { SessionRateLimit } from 'claude-code'

import { bar } from './meters'

// Plan quota: the 5h and 7d windows, their reset countdown and a "full in ~Xh" forecast from the
// burn rate over kept samples. Ported from quota-meter (MIT, see THIRD-PARTY.md), trimmed to the
// one line the status line and the Desk pane draw. Pure: nothing here touches `$`.

export type Sample = { atMs: number; percentUsed: number; resetsAt?: string }
export type Samples = Record<string, Sample[]>

const HOUR = 3600e3
export const windowMsOf = (kind: string) => (kind === 'five_hour' ? 5 * HOUR : 7 * 24 * HOUR)
const SHORT: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
const ORDER = ['five_hour', 'seven_day', 'spend_limit']
const MAX_SAMPLES = 240
// Whole-percent readings: one point over a few minutes reads as a huge rate, so the slope waits
// until the samples span a twentieth of the window.
const SPAN_FRACTION = 0.05
const RESET_DROP = 0.5

// What the store holds, keeping only well-formed samples (an older version or a torn write).
export function samplesOf(stored: unknown): Samples {
  if (typeof stored !== 'object' || stored === null) return {}
  const out: Samples = {}
  for (const [kind, rows] of Object.entries(stored as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue
    const kept = rows.filter((r): r is Sample => typeof r === 'object' && r !== null && Number.isFinite((r as Sample).atMs) &&
      Number.isFinite((r as Sample).percentUsed) && ((r as Sample).resetsAt === undefined || typeof (r as Sample).resetsAt === 'string'))
    if (kept.length) out[kind] = kept
  }
  return out
}

// A moved reset time or a fallen percent means a new window: the older samples belong to the old one.
export function addSample(kept: readonly Sample[], next: Sample, windowMs: number): Sample[] {
  const last = kept.at(-1)
  const reset = last !== undefined && ((last.resetsAt !== undefined && next.resetsAt !== undefined && last.resetsAt !== next.resetsAt) ||
    next.percentUsed < last.percentUsed - RESET_DROP)
  const rows = [...(reset ? [] : kept.filter((s) => s.atMs >= next.atMs - windowMs && s.atMs < next.atMs)), next]
  return rows.slice(-MAX_SAMPLES)
}

// Percent per hour, first sample to last; null until the span means something.
export function burnOf(samples: readonly Sample[], windowMs: number): number | null {
  const first = samples[0], last = samples.at(-1)
  if (!first || !last || samples.length < 2) return null
  const span = last.atMs - first.atMs
  return span < windowMs * SPAN_FRACTION ? null : ((last.percentUsed - first.percentUsed) / span) * HOUR
}

// `1h12m`, `42m`, `2d 3h`.
export function durationOf(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60e3)), h = Math.floor(m / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return h > 0 ? `${h}h${String(m % 60).padStart(2, '0')}m` : `${m}m`
}

export type Quota = { rows: { name: string; pct: number; until: number | null }[]; tail: string }

// The windows (5h first) with their reset countdown, and the tail: the window that fills before it resets, if any.
export function quotaOf(limits: readonly SessionRateLimit[], samples: Samples, now: number): Quota | undefined {
  if (!limits.length) return undefined
  const rank = (k: string) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.length)
  const rows = [...limits].sort((a, b) => rank(a.kind) - rank(b.kind)).map((l) => {
    const pct = Math.round(l.percentUsed) // the API reports whole percent, not always exactly (7.000000000000001)
    const burn = burnOf(samples[l.kind] ?? [], windowMsOf(l.kind))
    const reset = l.resetsAt ? Date.parse(l.resetsAt) : NaN
    return { short: SHORT[l.kind] ?? l.kind, pct, burn, until: Number.isFinite(reset) ? Math.max(0, reset - now) : null,
      fullIn: burn === null || burn <= 0 ? null : Math.max(0, ((100 - pct) / burn) * HOUR) }
  })
  const full = rows.filter((r) => r.fullIn !== null && (r.until === null || r.fullIn < r.until)).sort((a, b) => a.fullIn! - b.fullIn!)[0]
  const tail = full ? `${full.short} full in ~${durationOf(full.fullIn!)}` : rows.every((r) => r.burn === null) ? 'collecting burn rate' : 'nothing hits 100% before reset'
  return { rows: rows.map((r) => ({ name: r.short, pct: r.pct, until: r.until })), tail }
}

// The pane row: `5h ▰▰▰▰▱▱▱▱▱▱ 42% · resets 2h10m · 7d ▰▰▱▱▱▱▱▱▱▱ 18% · 5h full in ~3h05m`.
export function quotaLine(q: Quota): string {
  const parts = q.rows.map((r, i) => `${r.name} ${bar(r.pct, 10)} ${r.pct}%${i === 0 && r.until !== null ? ` · resets ${durationOf(r.until)}` : ''}`)
  return [...parts, q.tail].join(' · ') // the pane wraps; the status line no longer carries this text
}
