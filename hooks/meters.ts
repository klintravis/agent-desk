import type { Engine } from 'claude-code'

import type { DeskMeters } from '../types'
import { showMeters, warmOff } from './pane'
import { addSample, quotaOf, samplesOf, windowMsOf, type Samples } from './quota'

// The session's meters and the plugin's one status line (the engine keeps one per plugin): `ctx <bar> 42% ·
// 5h <bar> 31% · warm auto · ⚑ 1`. The warm and ⚑ slots are a desk's. The numbers also go to the pane/band atom.
export const line = { desk: false, off: false, flag: 0 }
let m: DeskMeters = {}

// A bar of `width` cells, the nearest cell to the percent; the percent always sits beside it.
export function bar(pct: number, width: number): string {
  const f = Math.round(Math.min(100, Math.max(0, pct)) / 100 * width)
  return '▰'.repeat(f) + '▱'.repeat(width - f)
}

// Cache hit, after token-ledger (MIT, THIRD-PARTY.md): `desk tokens`' cache read / all input, over the
// main session's turns. No dollar amount: cost differs by plan. shortcut: subagent turns are left out of the cache %, add them if it misleads.
const io = { all: 0, read: 0 }
export function addTurn(u: { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }) {
  io.all += u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
  io.read += u.cache_read_input_tokens
}
export const cachePct = (t = io): number | undefined => (t.all ? Math.round((t.read / t.all) * 100) : undefined)
export const cacheLine = (pct: number) => `${pct}% hit`
export const CTX_HINT = 80

const tok = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`)
// After context-lens (MIT, THIRD-PARTY.md). Nothing before the first response.
export function ctxOf(c: { tokens?: number; window: number; percent?: number }): DeskMeters['ctx'] {
  if (!c.tokens || !c.window) return undefined
  return { pct: c.percent ?? Math.round((c.tokens / c.window) * 100), tokens: c.tokens, window: c.window }
}
// The pane row: `▰▰▰▰▱▱▱▱▱▱ 42%  84k/200k`.
export const ctxLine = (c: NonNullable<DeskMeters['ctx']>) => `${bar(c.pct, 10)} ${c.pct}%  ${tok(c.tokens)}/${tok(c.window)}`

const QUOTA_KEY = 'quota-samples'
let samples: Samples = {}

export function paint($: Engine) {
  const q = m.quota?.rows.find((r) => r.name === '5h') ?? m.quota?.rows[0]
  const slots = [m.ctx && `ctx ${bar(m.ctx.pct, 8)} ${m.ctx.pct}%`, q && `${q.name} ${bar(q.pct, 4)} ${q.pct}%`,
    line.desk && `warm ${line.off ? 'off' : 'auto'}`, line.desk && line.flag > 0 && `⚑ ${line.flag}`].filter(Boolean)
  try { $.ui.status(slots.join(' · ') || undefined) } catch {}
  void showMeters($, m).catch(() => {})
}

export async function startMeters($: Engine, desk: boolean) {
  line.desk = desk
  line.off = await warmOff($)
  line.flag = 0
  samples = samplesOf(await Promise.resolve().then(() => $.store.get(QUOTA_KEY)).catch(() => undefined))
}

// Read after every main turn and each minute (the tick also moves the reset countdown).
// shortcut: sessions share the store key and the last writer wins; fine for a slope over minutes.
export async function meter($: Engine) {
  const u = await $.session.usage()
  const now = await $.clock.now()
  for (const l of u.rateLimits) {
    if (Number.isFinite(l.percentUsed)) samples[l.kind] = addSample(samples[l.kind] ?? [], { atMs: now, percentUsed: Math.round(l.percentUsed), resetsAt: l.resetsAt }, windowMsOf(l.kind))
  }
  if (u.rateLimits.length) void $.store.set(QUOTA_KEY, samples).catch(() => {})
  m = { ctx: ctxOf(u.context), cache: cachePct(), quota: quotaOf(u.rateLimits, samples, now) }
  paint($)
}
