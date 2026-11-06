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
  if (r.messages === undefined) throw new Error('compaction was skipped')
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

test('a snapshot through PowerShell or git -C stays whole, other git output is cut', async ($, on) => {
  engine(on, [])
  const calls = [
    ['dash-c', 'Bash', 'git -C /repo status --short'],
    ['quoted', 'Bash', 'git -C "/my repo" stash list'],
    ['ps', 'PowerShell', 'git status'],
    ['ps-dash-c', 'PowerShell', 'git -C C:\\repo status'],
    ['ps-single', 'PowerShell', "git -C 'C:\\my repo' status"],
    ['log', 'Bash', 'git -C /repo log'],
    ['ps-log', 'PowerShell', 'git log'],
    ['ps-log-p', 'PowerShell', 'git log -p'],
  ]
  const r = await $.session.compact({ trigger: 'auto', messages: [
    { role: 'user', text: 'start', toolUses: [] },
    { role: 'assistant', text: '', toolUses: calls.map(([tool_use_id, tool, command]) => ({ tool_use_id: tool_use_id!, tool: tool!, input: { command } })) },
    { role: 'user', text: '', toolUses: [], toolResults: calls.map(([tool_use_id]) => ({ tool_use_id: tool_use_id!, text: big('s'), isError: false })) },
    ...filler(8),
  ] })
  const kept = r.messages?.[2]?.toolResults?.filter((x) => x.text.length === 20_000).map((x) => x.tool_use_id)
  expect(kept).toEqual(['dash-c', 'quoted', 'ps', 'ps-dash-c', 'ps-single'])
})

// As the engine hands them over: one response's parallel calls are separate rows, each with a handle.
function parallelCalls(
  first: SessionMessage['toolUses'][number],
  second: SessionMessage['toolUses'][number] = { tool_use_id: 'r2', tool: 'Read', input: { file_path: 'b.ts' }, text: big('r') },
): SessionMessage[] {
  return [
    { role: 'user', text: 'start', toolUses: [], handle: 'h0' },
    { role: 'assistant', text: '', handle: 'a1', toolUses: [first] },
    { role: 'assistant', text: '', handle: 'a2', toolUses: [second] },
    { role: 'user', text: '', toolUses: [], handle: 'u1', toolResults: [{ tool_use_id: first.tool_use_id, text: big('r'), isError: false }] },
    { role: 'user', text: '', toolUses: [], handle: 'u2', toolResults: [{ tool_use_id: second.tool_use_id, text: big('r'), isError: false }] },
    ...filler(8),
  ]
}

test('parallel calls keep their handles while their results are cut', async ($, on) => {
  engine(on, [])
  const first = { tool_use_id: 'r1', tool: 'Read', input: { file_path: 'a.ts' }, text: big('r') }
  const r = await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: parallelCalls(first) })
  expect(r.messages?.[1]?.handle).toBe('a1')
  expect(r.messages?.[2]?.handle).toBe('a2')
  expect(r.messages?.[3]?.toolResults?.[0]?.text).toContain('[pruned')
  expect(r.messages?.[4]?.toolResults?.[0]?.text).toContain('[pruned')
})

test('a write call running in parallel stays whole, with its handle', async ($, on) => {
  engine(on, [])
  const first = { tool_use_id: 'w1', tool: 'Write', input: { file_path: 'a.ts', content: big('w') }, text: 'ok' }
  const r = await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: parallelCalls(first) })
  expect(r.messages?.[1]?.handle).toBe('a1')
  expect(String(r.messages?.[1]?.toolUses[0]?.input.content).length).toBe(20_000)
})

test('a write call last in its parallel group stays whole, with its handle', async ($, on) => {
  engine(on, [])
  const first = { tool_use_id: 'r1', tool: 'Read', input: { file_path: 'a.ts' }, text: big('r') }
  const second = { tool_use_id: 'w2', tool: 'Write', input: { file_path: 'b.ts', content: big('w') }, text: 'ok' }
  const r = await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: parallelCalls(first, second) })
  expect(r.messages?.[2]?.handle).toBe('a2')
  expect(String(r.messages?.[2]?.toolUses[0]?.input.content).length).toBe(20_000)
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
