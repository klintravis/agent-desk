import type { Register, SessionCompacted } from 'claude-code'

import { reason, verdict } from './editguard.mjs'
import { addTurn, meter, startMeters } from './meters'
import { inDesk, recordStyle, registerPane, setWhy, startPane, trackAgents, warmOff } from './pane'
import { prune } from './prune'
import { redactPrompt, registerRedact } from './redact'
import { AUTO_WARM, coldSend, mainRequest, mainTurn, newHold, tick, TICK } from './warmhold'

// Below this the cut is not worth it; the engine's summary runs instead.
export const MIN_SAVING = 0.3
const ACTIVE = new Set(['pending', 'running'])

export const register: Register = (on) => {
  // Prune: on automatic compaction, in the main session and in subagents, cut re-readable tool
  // output first and keep the conversation word for word. Manual /compact and small savings go to
  // the summary as before.
  // shortcut: a prune that still leaves the context over the window is followed by a summary on the
  // next compaction (already-cut outputs save nothing), not in the same one.
  on('session.compact', async ($, e, next) => {
    if (e.trigger !== 'auto') return next(e)
    let r: ReturnType<typeof prune>
    try { r = prune(e.messages) } catch { return next(e) } // a prune bug must never block compaction
    const saving = 1 - r.after / Math.max(1, r.before)
    if (saving < MIN_SAVING) return next(e)

    const result: SessionCompacted = { messages: r.messages }
    if (e.agentId === undefined) {
      const tokens = (await $.session.usage().catch(() => undefined))?.context.tokens
      if (tokens) {
        result.tokensBefore = tokens
        result.tokensAfter = Math.round(tokens * (1 - saving))
      }
      $.ui.toast(`agent-desk: tool output cut, context −${Math.round(saving * 100)}%, messages kept as written`)
    }
    return result
  })

  // Warm-hold: arms itself while this session has agents running, keeps the main cache warm with a
  // ping before the hour, and disarms when they finish (see warmhold.ts).
  // Outside a desk: no pane, no warm-hold, no edit guard. Prune and the meters stay: they are not desk rules.
  let hold = newHold(Date.now())
  let desk = false
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    desk = await inDesk($)
    await startMeters($, desk)
    if (desk) hold = newHold(await $.clock.now(), (await $.session.usage().catch(() => undefined))?.context.tokens ?? 0)
    $.clock.every(TICK, () => {
      void meter($).catch(() => {})
      if (!desk) return
      void tick(hold, {
        now: () => $.clock.now(),
        // shortcut: age is first-seen on the minute tick; switch to agent.spawn if AgentInfo never gains a start time
        active: async () => trackAgents($, (await $.agent.list()).filter((a) => ACTIVE.has(a.status)), await $.clock.now()),
        fork: (prompt) => $.model.fork({ prompt }),
        off: () => warmOff($),
        status: (why) => void setWhy($, why).catch(() => {}),
      }).catch(() => {})
    })
    void meter($).catch(() => {})
    if (desk) await startPane($, e.isInteractive || attached).catch(() => {}) // the Desk pane (pane.tsx)
    return r
  })
  // The VS Code extension and the desktop app run the SDK (isInteractive false, no surface); the editor
  // attaches later. A surface attaching starts the pane too; a REPL that also gets a phone starts it once.
  // An attach that lands before session.start has found the desk is picked up by start via `attached`.
  let attached = false
  on('session.attach', async ($, e, next) => {
    const r = await next(e)
    attached = true
    if (desk) await startPane($, true).catch(() => {})
    return r
  })
  // Cold-cache guard: before the user's own send to a cold main cache, say what it rewrites (warn);
  // AGENT_DESK_COLD_GUARD=refuse drops the first such send instead. A cold write then arms warm-hold.
  // Redaction (redact.ts) runs first, everywhere: it is not a desk rule.
  on('prompt.submit', async ($, e0, next) => {
    let e = e0
    try { e = { ...e0, text: redactPrompt($, e0.text) } } catch {} // a redactor bug must never block a send
    if (!desk || e.origin.kind !== 'composer' || e.text.trimStart().startsWith('/')) return next(e)
    let c: ReturnType<typeof coldSend> = null
    try {
      const ctx = (await $.session.usage()).context.tokens ?? 0
      c = coldSend(hold, await $.clock.now(), ctx, (await $.env.get('AGENT_DESK_COLD_GUARD')) === 'refuse', await warmOff($))
    } catch {} // a guard bug must never block a send
    if (c?.drop) return { drop: `agent-desk: ${c.text}` }
    if (c) $.ui.log(`agent-desk: ${c.text}`)
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r // a subagent's turn reads the same windows, another cache
    if (e.usage) addTurn(e.usage)
    await meter($).catch(() => {})
    if (desk && e.usage) {
      try {
        const ctx = (await $.session.usage()).context.tokens ?? 0
        if (mainTurn(hold, await $.clock.now(), e.usage.cache_creation_input_tokens, e.usage.cache_read_input_tokens, ctx)) {
          if (await warmOff($)) hold.armedUntil = 0 // keep-warm is off: the clock ran, nothing arms
          else $.ui.log(`agent-desk: cold write of ~${Math.round(e.usage.cache_creation_input_tokens / 1e3)}k tokens; warm-hold armed for ${AUTO_WARM / 3600e3}h`)
        }
      } catch {}
    }
    return r
  })
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) mainRequest(hold, await $.clock.now())
    yield* next(e)
  })

  // Output style: the engine has no getter, only the compose input; record it for the pane's Style row, change nothing.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    try {
      if (desk && !e.traits.some((t) => t === 'teammate' || t === 'analysis')) {
        await recordStyle($, e.outputStyle?.name ?? null)
      }
    } catch {}
    return r
  })

  // Edit guard: refuse shell-scripted file edits (rule shared with scripts/edit-guard.mjs, the
  // settings hook it will replace). Fails open: a guard bug must never block Bash.
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    let why: string | null = null
    try { why = desk ? verdict(e.command) : null } catch {}
    return why ? { deny: reason(why) } : next(e)
  })

  registerPane(on)
  registerRedact(on)
}
