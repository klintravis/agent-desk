import { expect, test } from 'claude-code/testing'

import { durationOf } from './quota'

const PANE = {
  plugin: 'agent-desk',
  component: 'Pane',
  requestId: 'desk-status',
  props: { title: 'Desk', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

type On = Parameters<Parameters<typeof test>[1]>[1]
const wait = () => new Promise((r) => setTimeout(r, 10))

// `desk status --json` as the CLI prints it: the data fields plus `text`.
const json = (o: { decisions?: { id: string; title: string }[]; claims?: { slug: string; from: string; ts: string; last: string | null }[]; text?: string } = {}) =>
  JSON.stringify({ v: 1, at: '2026-11-01T00:00:00Z', decisions: [], active: [], claims: [], sessions: null, roots: [], branches: [], prs: null, overlaps: null, tokens: null, text: '# Desk status', ...o })

function engine(on: On, seen: { argv: string[][]; opened: number; names?: string[] }) {
  on('command.register', (_$, e) => { seen.names?.push(e.name); return { value: { command: e.name } } })
  on('ui.open', () => { seen.opened++; return { value: { isPlaced: true } } })
  on('clock.every', () => ({ value: () => {} }))
  on('clock.now', () => ({ value: 0 }))
  on('process.run', (_$, e) => {
    seen.argv.push([...e.argv])
    const stdout = e.argv.at(-1) === '--json' ? json({ text: '# Desk status\n## Claims\n- cb-skill: 30c8274a' }) : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.attach', (_, e) => ({ clientId: e.clientId }))
}

test('an interactive session opens the pane and shows desk status', async ($, on) => {
  const seen = { argv: [] as string[][], opened: 0 }
  engine(on, seen)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  expect(seen.argv.map((a) => a.slice(2))).toEqual([['home'], ['status', '--json']])
  expect(seen.opened).toBe(1)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /cb-skill/ }))?.text).toBe('- cb-skill: 30c8274a')
    await ui.unmount()
  }
})

// The VS Code extension and the desktop app: an SDK session (not interactive, no surface); the editor attaches later.
test('an SDK session starts the pane when a surface attaches', async ($, on) => {
  const seen = { argv: [] as string[][], opened: 0, names: [] as string[] }
  engine(on, seen)
  await $.session.start({ cwd: '/', isInteractive: false } as never)
  await wait()
  expect([seen.names, seen.opened]).toEqual([[], 0])
  await $.session.attach({ surface: 'vscode', clientId: 'vscode:default' })
  await wait()
  expect([seen.names, seen.opened]).toEqual([['desk', 'decide'], 1])
})

test('an interactive session that also gets a surface attached starts the pane once', async ($, on) => {
  const seen = { argv: [] as string[][], opened: 0, names: [] as string[] }
  engine(on, seen)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.attach({ surface: 'mobile', clientId: 'mobile:default' })
  await wait()
  expect([seen.names, seen.opened, seen.argv.filter((a) => a[2] === 'status').length]).toEqual([['desk', 'decide'], 1, 1])
})

test('a headless session runs only the desk probe and opens nothing', async ($, on) => {
  const seen = { argv: [] as string[][], opened: 0, names: [] as string[] }
  engine(on, seen)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
  expect([seen.argv.map((a) => a.at(-1)), seen.opened]).toEqual([['home'], 0]) // only the desk probe
  expect(seen.names).toEqual([])
})

test('a surface that attaches before the desk probe finishes still starts the pane once', async ($, on) => {
  const seen = { argv: [] as string[][], opened: 0, names: [] as string[] }
  engine(on, seen)
  const p = $.session.start({ cwd: '/', surface: null, isInteractive: false } as never)
  await $.session.attach({ surface: 'vscode', clientId: 'vscode:default' })
  await p
  await wait()
  expect([seen.names, seen.opened]).toEqual([['desk', 'decide'], 1])
})

test('outside a desk the plugin is inert: no pane, no status, no edit guard', async ($, on) => {
  const argv: string[][] = []
  let opened = 0
  on('ui.open', () => { opened++; return { value: { isPlaced: true } } })
  on('clock.every', () => ({ value: () => {} }))
  on('clock.now', () => ({ value: 0 }))
  on('process.run', (_$, e) => {
    argv.push([...e.argv])
    return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ran' }) as never)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  expect([argv.map((a) => a.at(-1)), opened]).toEqual([['home'], 0])
  const r = await $.tool.call({ tool: 'Bash', command: "sed -i 's/a/b/' x.ts" } as never)
  expect('deny' in r).toBe(false)
})

const BAND = (surface: 'terminal' | 'desktop', hasSurvey = false) => ({
  plugin: 'agent-desk', component: 'AbovePrompt', surface,
  props: { hasSurvey, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const)

// A desk: `home` exits 0, `status --json` prints `status.s`, `decide` records.
function deskStub(on: On, status: { s: string }, argv: string[][], home = 0, o: { shown?: (string | undefined)[]; ticks?: (() => void)[]; clock?: { t: number } } = {}) {
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', (_$, e) => { o.shown?.push(e.text); return { value: undefined } })
  // Each period is a dispatch; the plugin's fn runs when it resolves. With `ticks` the test holds the dispatch and fires it by hand.
  on('clock.every', () => o.ticks ? new Promise((res) => o.ticks!.push(() => res({ value: undefined }))) : ({ value: () => {} }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('clock.now', () => ({ value: o.clock?.t ?? 0 }))
  on('process.run', (_$, e) => {
    argv.push([...e.argv])
    const sub = e.argv[2]
    const stdout = sub === 'decide' ? 'Recorded T-5: take A' : sub === 'status' ? status.s : ''
    return { value: { exitCode: sub === 'home' ? home : 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}
// Hidden = the hook hands the band to next(e); with no engine band beneath in a test, that mount throws.
const handsOn = ($: Parameters<Parameters<typeof test>[1]>[0], b: ReturnType<typeof BAND>) => $.ui.mount(b).then(() => 'drawn', (err) => String(err))

const TWO = [{ id: 'T-5', title: 'pick A' }, { id: 'T-6', title: 'pick B' }]

test('pane: rows read the status JSON', async ($, on) => {
  deskStub(on, { s: json({ decisions: TWO, claims: [{ slug: 'cb-skill', from: 'main', ts: '1970-01-01T00:00:00Z', last: null }], text: '# Desk status\n## Owner decisions waiting\n- T-5 pick A' }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: /^T-5 pick A$/ }))?.text).toBe('T-5 pick A') // the Decide row
  expect((await pane.find({ type: 'Text', text: /cb-skill · main/ }))?.text).toBe('cb-skill · main · claimed 0m00s'.replace('0m00s', durationOf(0)))
  expect((await pane.find({ type: 'Text', text: /^- T-5 pick A$/ }))?.text).toBe('- T-5 pick A') // the text screen under the divider
  expect((await pane.find({ type: 'Text', text: /^── desk status ──$/ }))?.text).toBe('── desk status ──')
  await pane.unmount()
})

test('pane: band shows decisions and near-full, hides when neither', async ($, on) => {
  const status = { s: json({ decisions: TWO }) }
  const usage = { pct: 10 }
  deskStub(on, status, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: usage.pct * 10, window: 1000, percent: usage.pct }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  let ui = await $.ui.mount(BAND('terminal'))
  expect((await ui.find({ type: 'Text', text: /waiting/ }))?.text).toBe('⚑ 2 decisions waiting ')
  await ui.unmount()
  expect(await handsOn($, BAND('terminal', true))).toContain('no implementation for ui.render') // a survey holds the band

  // Near full: the red row joins the decisions row.
  usage.pct = 85
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 't' } as never).catch(() => {})
  await wait()
  ui = await $.ui.mount(BAND('terminal'))
  expect((await ui.find({ type: 'Text', text: /near full/ }))?.text).toBe('ctx ▰▰▰▰▰▰▰▱ 85%  near full: handoff or /compact')
  await ui.unmount()

  // Recording the last decision refreshes the status at once; below 80% nothing is left to show.
  status.s = json()
  usage.pct = 10
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 't' } as never).catch(() => {})
  await $.command.run({ command: 'decide', args: 'T-5 take A' })
  await wait()
  expect(await handsOn($, BAND('desktop'))).toContain('no implementation for ui.render')
})

test('pane: outside a desk the band shows only near-full', async ($, on) => {
  deskStub(on, { s: json({ decisions: TWO }) }, [], 1)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 900, window: 1000, percent: 90 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const ui = await $.ui.mount(BAND('terminal'))
  expect((await ui.find({ type: 'Text', text: /near full/ }))?.text).toBe('ctx ▰▰▰▰▰▰▰▱ 90%  near full: handoff or /compact')
  expect(await ui.find({ type: 'Text', text: /waiting/ })).toBeFalsy() // no decisions row outside a desk
  await ui.unmount()
})

test('/decide passes the id and the ruling as two argv elements', async ($, on) => {
  const argv: string[][] = []
  deskStub(on, { s: '' }, argv)
  const r = await $.command.run({ command: 'decide', args: '  T-5 take A; "quoted" too ' })
  expect(argv.at(-2)?.slice(2)).toEqual(['decide', 'T-5', 'take A; "quoted" too'])
  expect(argv.at(-1)?.slice(2)).toEqual(['status', '--json'])
  expect(r.text).toBe('Recorded T-5: take A')
  await $.command.run({ command: 'decide', args: '' })
  expect(argv.at(-1)?.slice(2)).toEqual(['decide'])
  await $.command.run({ command: 'decide', args: '--list 5' })
  expect(argv.at(-1)?.slice(2)).toEqual(['decide', '--list', '5'])
})

test('in a desk the meters head the pane', async ($, on) => {
  deskStub(on, { s: json() }, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 84_000, window: 200_000, percent: 42 }, rateLimits: [{ kind: 'seven_day', percentUsed: 7 }] } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: /7d/ }))?.text).toBe('7d ▰▱▱▱▱▱▱▱▱▱ 7% · collecting burn rate')
  expect((await pane.find({ type: 'Text', text: /84k/ }))?.text).toBe('▰▰▰▰▱▱▱▱▱▱ 42%  84k/200k')
  await pane.unmount()
})

test('pane: warm toggle flips from onPress', async ($, on) => {
  const shown: (string | undefined)[] = []
  deskStub(on, { s: json() }, [], 0, { shown })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', key: 'warm' }))?.text).toBe('auto')
  expect(shown.at(-1)).toContain('warm auto')
  await ui.press({ key: 'warm' })
  await wait()
  expect((await ui.find({ type: 'Button', key: 'warm' }))?.text).toBe('off')
  expect((await ui.find({ type: 'Text', text: /off for this session/ }))?.text).toBe(' off for this session')
  expect(shown.at(-1)).toContain('warm off')
  await ui.press({ key: 'warm' })
  await wait()
  expect((await ui.find({ type: 'Button', key: 'warm' }))?.text).toBe('auto')
  await ui.unmount()
})

test('pane: two warm presses before a redraw leave the atom and the status line agreeing', async ($, on) => {
  const shown: (string | undefined)[] = []
  deskStub(on, { s: json() }, [], 0, { shown })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'warm' })
  await ui.press({ key: 'warm' })
  await wait()
  expect(shown.at(-1)).toContain('warm auto')
  expect((await ui.find({ type: 'Button', key: 'warm' }))?.text).toBe('auto')
  await ui.unmount()
})

test('pane: a Decide press runs /decide, then leaves /decide T-n in the prompt (band and pane)', async ($, on) => {
  const ran: string[] = []
  deskStub(on, { s: json({ decisions: TWO }) }, [])
  on('command.run', { command: 'decide' }, (_$, e) => { ran.push(e.command); return { text: 'T-5 (1 of 2): pick A' } }) // a press asks the engine to run /decide
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('prompt.fill', (_$, e) => { ran.push(e.text); return { isFilled: true } as never })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  for (const site of [BAND('terminal'), { ...PANE, surface: 'terminal' } as const]) {
    const ui = await $.ui.mount(site)
    expect((await ui.find({ type: 'Button', key: 'decide' }))?.text).toBe('Decide T-5')
    await ui.press({ key: 'decide' })
    await wait()
    await ui.unmount()
  }
  expect(ran).toEqual(['decide', '/decide T-5 ', 'decide', '/decide T-5 '])
})

for (const [name, text, draft, want] of [
  ['the id /decide printed, not the stale one on the button', 'T-60 (1 of 3): newer', '', ['/decide T-60 ']],
  ['nothing when no decision waits any more', 'No owner decisions waiting.', '', []],
  ['nothing over a draft', 'T-5 (1 of 2): pick A', 'half typed', []],
] as const) {
  test(`pane: a Decide press fills ${name}`, async ($, on) => {
    const filled: string[] = []
    deskStub(on, { s: json({ decisions: TWO }) }, [])
    on('command.run', { command: 'decide' }, () => ({ text }))
    on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }) as never)
    on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } as never })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await wait()
    const ui = await $.ui.mount(BAND('terminal'))
    await ui.press({ key: 'decide' })
    await wait()
    await ui.unmount()
    expect(filled).toEqual([...want])
  })
}

test('pane: agents keep their first-seen time across ticks', async ($, on) => {
  const ticks: (() => void)[] = []
  const clock = { t: 0 }
  deskStub(on, { s: json() }, [], 0, { ticks, clock })
  on('agent.list', () => ({ value: [{ id: 'a1', type: 'implementer', description: 'build it', status: 'running' }] }) as never)
  on('model.fork', () => ({ value: { isAnswered: true, text: 'ok' } }) as never)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  for (const t of [0, 120_000]) {
    clock.t = t
    for (const run of ticks.splice(0)) run()
    await wait()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /build it/ }))?.text).toBe(`implementer · build it · ${durationOf(120_000)}`)
  await ui.unmount()
})

test('register: compose records the output style and leaves the result unchanged', async ($, on) => {
  const sections = [{ id: 'a', text: 'x', scope: 'shared' }] as never
  deskStub(on, { s: json() }, [])
  on('prompt.compose', () => ({ sections }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const r = await $.prompt.compose({ promptModel: 'm', tools: [], surfaces: [], outputStyle: { name: 'Explanatory', isKeepingCodingInstructions: true }, traits: [] })
  expect(r.sections).toEqual(sections)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Explanatory/ }))?.text).toBe('Explanatory')
  await ui.unmount()
})

test('a value an earlier version stored is declined', async ($, on) => {
  on('state.get', () => ({ value: { value: 42, version: 1 } }))
  on('clock.now', () => ({ value: 0 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Loading desk status/ }))?.text).toBe('Loading desk status…')
  await ui.unmount()
})
