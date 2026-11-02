import type { On, SessionCompactInput, SessionMessage } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const big = (c: string) => c.repeat(20_000)
const filler = (n: number): SessionMessage[] =>
  Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', text: `turn ${i}`, toolUses: [] }))

function transcript(): SessionMessage[] {
  return [
    { role: 'user', text: 'start', toolUses: [] },
    { role: 'assistant', text: '', toolUses: [
      { tool_use_id: 'read', tool: 'Read', input: { file_path: 'a.ts' } },
      { tool_use_id: 'agent', tool: 'Agent', input: { prompt: 'x' } },
      { tool_use_id: 'status', tool: 'Bash', input: { command: 'git status' } },
      { tool_use_id: 'fail', tool: 'Bash', input: { command: 'npm test' } },
      { tool_use_id: 'edit', tool: 'Write', input: { file_path: 'b.ts', content: big('w') } },
    ] },
    { role: 'user', text: '', toolUses: [], toolResults: [
      { tool_use_id: 'read', text: big('r'), isError: false },
      { tool_use_id: 'agent', text: big('a'), isError: false },
      { tool_use_id: 'status', text: big('s'), isError: false },
      { tool_use_id: 'fail', text: big('f'), isError: true },
      { tool_use_id: 'edit', text: 'ok', isError: false },
    ] },
    ...filler(8),
  ]
}

function engine(on: On, seen: SessionCompactInput[]) {
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 200_000, window: 1_000_000, percent: 20 }, rateLimits: [] } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.compact', (_$, e) => {
    seen.push(e)
    return { messages: [{ role: 'assistant' as const, text: 'summary', toolUses: [] }] }
  })
}

test('auto compaction cuts re-readable output and keeps the rest word for word', async ($, on) => {
  const seen: SessionCompactInput[] = []
  engine(on, seen)
  const before = transcript()
  const r = await $.session.compact({ trigger: 'auto', messages: before })

  expect(seen.length).toBe(0) // the engine's summary never ran
  const results = r.messages?.[2]?.toolResults ?? []
  const text = (id: string) => results.find((x) => x.tool_use_id === id)?.text ?? ''
  expect(text('read').length < 1000).toBe(true)
  expect(text('read')).toContain('[pruned')
  expect(text('agent').length).toBe(20_000)
  expect(text('status').length).toBe(20_000)
  expect(text('fail').length).toBe(20_000)
  const content = String(r.messages?.[1]?.toolUses.find((u) => u.tool === 'Write')?.input.content)
  expect(content).toContain('file on disk')
  expect(r.messages?.slice(-8).map((m) => m.text)).toEqual(before.slice(-8).map((m) => m.text))
  expect(r.tokensBefore).toBe(200_000)
})

test('a subagent compaction is pruned too', async ($, on) => {
  const seen: SessionCompactInput[] = []
  engine(on, seen)
  const r = await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: transcript() })
  expect(seen.length).toBe(0)
  expect(r.messages?.[2]?.toolResults?.[0]?.text).toContain('[pruned')
})

test('a small saving, or a manual /compact, goes to the summary', async ($, on) => {
  const seen: SessionCompactInput[] = []
  engine(on, seen)
  const talk: SessionMessage[] = [{ role: 'user', text: big('t'), toolUses: [] }, ...filler(12)]
  await $.session.compact({ trigger: 'auto', messages: talk })
  await $.session.compact({ trigger: 'manual', messages: transcript() })
  expect(seen.length).toBe(2)
})

test('a second auto compaction after a prune falls back to the summary', async ($, on) => {
  const seen: SessionCompactInput[] = []
  engine(on, seen)
  const once = await $.session.compact({ trigger: 'auto', messages: transcript() })
  await $.session.compact({ trigger: 'auto', messages: once.messages ?? [] })
  expect(seen.length).toBe(1)
})
