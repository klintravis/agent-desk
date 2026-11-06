import type { SessionMessage, ToolResultSummary, ToolUseSummary } from 'claude-code'

// Messages at both ends stay word for word: the task statement and the work in hand.
const KEEP_RECENT = 8
// A tool output longer than this is cut to its head.
const CUT_OVER = 1500
const HEAD = 400

// Output that costs more to get back than to keep: a subagent's report, or a
// snapshot of state that has moved on since.
const KEEP_TOOLS = new Set(['Agent', 'Task'])
const SNAPSHOT = /\b(git (-C ("[^"]*"|'[^']*'|\S+) )?(status|stash list)|gh run view|gh pr checks)\b/
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const cut = (text: string, note: string) =>
  text.length > CUT_OVER ? `${text.slice(0, HEAD)}\n[pruned ${text.length - HEAD} chars; ${note}]` : text

function shrink(value: unknown): unknown {
  if (typeof value === 'string') return cut(value, 'the file on disk holds the current content')
  if (Array.isArray(value)) return value.map(shrink)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shrink(v)]))
  return value
}

function keeps(use: ToolUseSummary | undefined, isError: boolean): boolean {
  if (!use || isError || KEEP_TOOLS.has(use.tool)) return true
  return (use.tool === 'Bash' || use.tool === 'PowerShell') && typeof use.input.command === 'string' && SNAPSHOT.test(use.input.command)
}

// Another row with tool calls in the same unbroken run of assistant rows.
function parallel(messages: readonly SessionMessage[], i: number): boolean {
  for (const step of [-1, 1]) {
    for (let k = i + step; messages[k]?.role === 'assistant'; k += step) if (messages[k]!.toolUses.length > 0) return true
  }
  return false
}

function charsOf(messages: readonly SessionMessage[]): number {
  // A transcript with result rows carries each output there; `use.text` repeats it.
  const rows = messages.some((m) => (m.toolResults ?? []).length > 0)
  let n = 0
  for (const m of messages) {
    n += m.text.length
    for (const u of m.toolUses) n += JSON.stringify(u.input).length + (rows ? 0 : u.text?.length ?? 0)
    for (const r of m.toolResults ?? []) n += r.text.length
  }
  return n
}

/**
 * Cuts re-readable tool output (file reads, searches, command output, edit bodies) to its head,
 * outside the first and the newest KEEP_RECENT messages. Text is never touched; errors, subagent
 * reports and state snapshots stay. Untouched messages are returned as the same objects, so they
 * keep the engine's handle. A copy loses it: the engine ignores any cut on a message with a handle,
 * and gives one without a new message id. Parallel calls of one response are separate rows sharing
 * an id, so a new id on one of them splits the response, and the engine stubs the split-off calls
 * with `Tool result missing`. So a call row is rebuilt only when it is alone in its assistant run.
 */
export function prune(messages: readonly SessionMessage[]): { messages: SessionMessage[]; before: number; after: number } {
  const uses = new Map<string, ToolUseSummary>()
  for (const m of messages) for (const u of m.toolUses) uses.set(u.tool_use_id, u)
  const pinned = (i: number) => i === 0 || i >= messages.length - KEEP_RECENT

  const out = messages.map((m, i) => {
    if (pinned(i)) return m
    // `use.text` is left alone: it repeats the result row and never reaches the model.
    const toolUses = parallel(messages, i) ? m.toolUses : m.toolUses.map((u) => {
      const input = WRITE_TOOLS.has(u.tool) ? (shrink(u.input) as Record<string, unknown>) : u.input
      if (JSON.stringify(input) === JSON.stringify(u.input)) return u
      const copy: ToolUseSummary = { tool_use_id: u.tool_use_id, tool: u.tool, input }
      if (u.text !== undefined) copy.text = u.text
      if (u.isError) copy.isError = true
      return copy
    })
    const toolResults = m.toolResults?.map((r): ToolResultSummary => {
      const use = uses.get(r.tool_use_id)
      if (keeps(use, r.isError)) return r
      const text = cut(r.text, `run ${use?.tool} again if needed`)
      return text === r.text ? r : { tool_use_id: r.tool_use_id, text, isError: r.isError }
    })
    const touched = toolUses.some((u, k) => u !== m.toolUses[k]) || (toolResults ?? []).some((r, k) => r !== m.toolResults?.[k])
    if (!touched) return m
    const copy: SessionMessage = { role: m.role, text: m.text, toolUses }
    if (toolResults) copy.toolResults = toolResults
    return copy
  })
  return { messages: out, before: charsOf(messages), after: charsOf(out) }
}
