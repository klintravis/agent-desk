/** `desk status --json` (schemas/desk-status.schema.json), the object the Desk pane and the band read. */
export type DeskStatus = {
  v: 2
  at: string
  decisions: { id: string; title: string; options?: { label: string; why?: string }[] }[]
  active: { id: string; title: string; status: string; [k: string]: unknown }[]
  /** Open, blocked and active todos except an active one on a branch or claim (that one is in Work); active first, then by priority; never owner decisions, nor ideas unless active. */
  todos?: { id: string; title: string; status: string; [k: string]: unknown }[]
  claims: { slug: string; from: string; ts: string; last: string | null }[]
  sessions: { session: string; title?: string; slug?: string; agents: { type: string; about: string }[] }[] | null
  roots: { id: string; kind: string; path: string; gh?: string; defaultBranch?: string; merge?: 'direct' | 'review'; sha?: string }[]
  branches: { slug: string; head: string; ci: string; state: string; verdictOld?: true; verdict: string | null; behind: { base: string; n: number } | null; pr?: { number: number; state: string; url: string; stale?: boolean } }[]
  prs: { slug: string; number: number; decision: string; comments: number; unresolved: number; sinceHead: number }[] | null
  overlaps: string[] | null
  tokens: { calls: number; fresh: number; cached: number; out: number } | null
  /** The active user layer: tasks below the shared value and values of the user file a floor raised; null when none is active. */
  user: {
    file: string
    below: { task: string; model: string; effort: string; shared: { model: string; effort: string } }[]
    raised: { task: string; model: string; effort: string; replaced: { model?: string; effort?: string } }[]
  } | null
  /** Why the screen is partial: the refusal when desk.config.json is refused. Absent when there is none. */
  warnings?: string[]
  /** The text screen, byte for byte what `desk status` prints. */
  text: string
}
/** The session's meters as numbers; each surface formats them (status line, band, pane). */
export type DeskMeters = {
  ctx?: { pct: number; tokens: number; window: number }
  /** Cache hit, whole percent. */
  cache?: number
  quota?: { rows: { name: string; pct: number; until: number | null }[]; tail: string }
}
/** Keep-warm for this session: `off` is the toggle (auto when false), `why` warm-hold's own state text. */
export type WarmState = { off: boolean; why?: string }
/** A running or pending agent; `since` is when the minute tick first saw it. */
export type AgentRow = { id: string; type: string; description: string; status: string; since: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-desk': {
      status: Shaped<DeskStatus | null>
      /** The last failed `desk status --json` run, else ''. */
      err: Shaped<string>
      meters: Shaped<DeskMeters>
      warm: Shaped<WarmState>
      /** The output style's name; null for the default. */
      style: Shaped<string | null>
      agents: Shaped<AgentRow[]>
      /** The pane's open tab: work, branches or desk. */
      tab: Shaped<string>
    }
  }
}
