import type { ModelForkResult } from 'claude-code'

// The main session's cache lives 1h. While it waits on its own agents (implementers ran 125–139
// min) nothing is sent, so the next turn rewrites the whole context. A ping just before the hour
// reads the prefix instead, keeping it warm for another hour.
export const PING_AFTER = 50 * 60e3
export const COLD_AFTER = 60 * 60e3
export const MAX_HOLD = 4 * 3600e3
export const TICK = 60e3
// After a cold write the hold also runs with no agents, so the rewrite is not paid again soon.
export const AUTO_WARM = 3 * 3600e3
// Below this a cold rewrite is cheap: no warning, no arming.
export const BIG = 50_000
const PING_PROMPT = 'Cache keep-alive while agents run. Reply with the single word: ok'

// The cold-cache guard and auto-arm are ported from cache-tax (MIT, see THIRD-PARTY.md).
export type Hold = {
  lastMainAt: number; since: number | null; stopped: string | null
  armedUntil: number; ackedAt: number | null; coldPending: boolean; ctx: number
}
export type Deps = {
  now: () => Promise<number>
  active: () => Promise<number> // this session's agents still pending or running
  fork: (prompt: string) => Promise<ModelForkResult>
  status: (text: string | undefined) => void
  off: () => Promise<boolean> // the session's keep-warm toggle (pane Warm row)
}

// A session that starts with a context already in it was resumed (or continued): its cache age is not
// known, so it counts as cold until its first main request, and that context is what a rewrite costs.
export const newHold = (now: number, startCtx = 0): Hold =>
  ({ lastMainAt: startCtx >= BIG ? now - COLD_AFTER : now, since: null, stopped: null, armedUntil: 0, ackedAt: null, coldPending: false, ctx: startCtx })

// Before the user's own send: null on a warm or small cache, else what the send rewrites. Refuse
// drops the first send per cold spell; the resend goes through (the price is then known and accepted).
export function coldSend(h: Hold, now: number, ctx: number, refuse: boolean, off = false): { text: string; drop: boolean } | null {
  if (now - h.lastMainAt < COLD_AFTER || ctx < BIG) return null
  // A 1h cache write bills 2x base input, a read 0.1x: the rewrite costs ~20 warm turns' input.
  const text = `cache cold for ${mins(now - h.lastMainAt - COLD_AFTER)}: this send re-writes ~${Math.round(ctx / 1e3)}k tokens, ~20x a warm turn's input`
  if (refuse && h.ackedAt !== h.lastMainAt) {
    h.ackedAt = h.lastMainAt
    return { text: `${text}. Send it again to pay it, or /clear and start from a note.`, drop: true }
  }
  h.coldPending = true
  return { text: off ? text : `${text}. Warm-hold arms for ${AUTO_WARM / 3600e3}h once it lands.`, drop: false }
}

// After a main turn: a cold write (flagged at send, or a write of half the context it started from while
// the prefix was not read back) arms the hold for AUTO_WARM. A turn that reads a big file writes new
// content but still reads its prefix from the cache: not cold. Returns whether it armed.
export function mainTurn(h: Hold, now: number, write: number, read: number, ctx: number): boolean {
  const cold = h.coldPending || (h.ctx > 20_000 && write >= 0.5 * h.ctx && read < 0.5 * h.ctx)
  h.coldPending = false
  h.ctx = ctx
  if (cold) h.armedUntil = now + AUTO_WARM
  return cold
}

// A main-session request refreshed the cache: start counting again.
export function mainRequest(h: Hold, now: number) {
  h.lastMainAt = now
  h.stopped = null
}

const mins = (ms: number) => `${Math.max(0, Math.round(ms / 60e3))}m`

export async function tick(h: Hold, d: Deps): Promise<'idle' | 'wait' | 'ping' | 'stop'> {
  const now = await d.now()
  const n = await d.active()
  if ((await d.off()) || (n === 0 && h.armedUntil <= now)) {
    h.since = null
    h.stopped = null
    h.armedUntil = 0
    d.status(undefined)
    return 'idle'
  }
  const why = n > 0 ? `${n} agent${n > 1 ? 's' : ''} running` : `armed after a cold write, ${mins(h.armedUntil - now)} left`
  h.since ??= now
  if (!h.stopped && now - h.since > MAX_HOLD) h.stopped = `held ${mins(MAX_HOLD)}, the cap`
  if (!h.stopped && now - h.lastMainAt >= COLD_AFTER) h.stopped = 'cache already cold, nothing to hold'
  if (h.stopped) {
    d.status(`warm-hold off: ${h.stopped}`)
    return 'stop'
  }
  if (now - h.lastMainAt < PING_AFTER) {
    d.status(`warm-hold: ${why}, ping in ${mins(h.lastMainAt + PING_AFTER - now)}`)
    return 'wait'
  }
  const r = await d.fork(PING_PROMPT).catch((err: unknown) => ({ isAnswered: false as const, reason: String(err) }))
  if (!r.isAnswered) h.stopped = `ping failed (${'reason' in r ? r.reason : 'no reply'})`
  // A warm ping reads the prefix and writes only its own tail; a big write means the prefix was gone.
  else if (r.usage.cache_creation_input_tokens >= 0.1 * Math.max(1, r.usage.cache_read_input_tokens)) h.stopped = 'the ping found the cache gone'
  else h.lastMainAt = now
  d.status(h.stopped ? `warm-hold off: ${h.stopped}` : `warm-hold: pinged, read ${Math.round(r.isAnswered ? r.usage.cache_read_input_tokens / 1e3 : 0)}k from cache`)
  return 'ping'
}
