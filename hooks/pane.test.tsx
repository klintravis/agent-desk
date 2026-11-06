import { expect, test, type TestBody } from 'claude-code/testing'

import type { DeskStatus } from '../types'
import { branchColor, branchNote, branchState, headline, LOOK_EVERY, overlapRows, prColor, quotaColor, worst } from './pane'
import { durationOf } from './quota'

const PANE = {
  plugin: 'agent-desk',
  component: 'Pane',
  requestId: 'desk-status',
  props: { title: 'Desk', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

type On = Parameters<TestBody>[1]
declare const setTimeout: (fn: (...a: never[]) => void, ms: number) => unknown // the test child has it; the hooks' lib does not
// What the engine stamps on `/decide` and passes to the kit's `$.command.run`.
const RUN = { origin: { kind: 'plugin' as const, name: 'test' }, presentation: { isFullscreen: false, columns: 80 } }
const wait = () => new Promise((r) => setTimeout(r, 10))

// `desk status --json` as the CLI prints it: the data fields plus `text`.
const json = (o: Partial<import('../types').DeskStatus> = {}) =>
  JSON.stringify({ v: 2, at: '2026-11-01T00:00:00Z', decisions: [], active: [], todos: [], claims: [], sessions: null, roots: [], branches: [], prs: null, overlaps: null, tokens: null, text: '# Desk status', ...o })

function engine(on: On, seen: { argv: string[][]; opened: number; names?: string[] }) {
  on('command.register', (_$, e) => { seen.names?.push(e.name); return { value: { command: e.name } } })
  on('ui.open', () => { seen.opened++; return { value: { isPlaced: true } } })
  on('clock.every', () => new Promise(() => {})) // a period that never ends: no tick
  on('clock.now', () => ({ value: 0 }))
  on('process.run', (_$, e) => {
    seen.argv.push([...e.argv])
    const stdout = e.argv.at(-1) === '--json' ? json({ decisions: [{ id: 'T-1', title: 'cb-skill' }] }) : ''
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
    await ui.press({ key: 'tab-decisions' })
    await wait()
    expect((await ui.find({ type: 'Text', text: /cb-skill/ }))?.text).toBe('T-1 cb-skill')
    await ui.unmount()
  }
})

test('a status from an older CLI with no todos renders the Todos tab as unavailable', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => new Promise(() => {}))
  on('clock.now', () => ({ value: 0 }))
  on('process.run', (_$, e) => {
    const { todos: _t, ...old } = JSON.parse(json())
    const stdout = e.argv.at(-1) === '--json' ? JSON.stringify(old) : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'tab-todos' }))?.text).toBe('Todos ?')
  await ui.press({ key: 'tab-todos' })
  await wait()
  expect(await ui.find({ type: 'Text', text: /^No open todos$/ })).toBeFalsy()
  await ui.unmount()
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
  on('clock.every', () => new Promise(() => {})) // a period that never ends: no tick
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
function deskStub(on: On, status: { s: string }, argv: string[][], home = 0, o: { shown?: (string | undefined)[]; ticks?: (() => void)[]; looks?: (() => void)[]; homePath?: string; hold?: () => Promise<void>; clock?: { t: number }; decide?: () => { exitCode?: number; stdout?: string; stderr?: string } } = {}) {
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', (_$, e) => { o.shown?.push(e.text); return { value: undefined } })
  // Each period is a dispatch; the plugin's fn runs when it resolves. With `ticks` the test holds the dispatch and fires it by hand; without, it never resolves: no tick.
  on('clock.every', (_$, e) => new Promise((res) => (e.ms === LOOK_EVERY ? o.looks : o.ticks)?.push(() => res({ value: undefined }))))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('clock.now', () => ({ value: o.clock?.t ?? 0 }))
  on('process.run', (_$, e) => {
    argv.push([...e.argv])
    const sub = e.argv[2]
    const d = (sub === 'decide' && o.decide?.()) || {}
    const stdout = d.stdout ?? (sub === 'decide' ? 'Recorded T-5: take A' : sub === 'status' ? status.s : sub === 'home' ? o.homePath ?? '' : '')
    const value = { value: { exitCode: d.exitCode ?? (sub === 'home' ? home : 0), stdout, stderr: d.stderr ?? '', isStdoutTruncated: false, isStderrTruncated: false } }
    return sub === 'status' && o.hold ? o.hold().then(() => value) : value
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}
// Hidden = the hook hands the band to next(e); with no engine band beneath in a test, that mount throws.
const handsOn = ($: Parameters<TestBody>[0], b: ReturnType<typeof BAND>) => $.ui.mount(b).then(() => 'drawn', (err) => String(err))

const TWO = [{ id: 'T-5', title: 'pick A' }, { id: 'T-6', title: 'pick B' }]

test('pane: rows read the status JSON', async ($, on) => {
  deskStub(on, { s: json({ decisions: TWO, claims: [{ slug: 'cb-skill', from: 'main', ts: '1970-01-01T00:00:00Z', last: null }], text: '# Desk status\n## Owner decisions waiting\n- T-5 pick A' }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^#/ })).toBeFalsy() // no raw status text
  expect((await pane.find({ type: 'Text', text: /cb-skill · main/ }))?.text).toBe('cb-skill · main · claimed 0m00s'.replace('0m00s', durationOf(0)))
  expect((await pane.find({ key: 'tab-decisions' }))?.text).toBe(`Decisions ${TWO.length}`)
  expect((await pane.findAll({ type: 'Button' })).map((b) => b.key).filter((k) => /^tab-/.test(k ?? ''))).toEqual(['tab-decisions', 'tab-work', 'tab-todos'])
  expect((await pane.findAll({ type: 'Text', text: '●' })).map((d) => d.props?.color)).toEqual(['yellow']) // find by key does not reach a Text; the decisions mark is the only dot; the closed tab says decisions wait
  expect(await pane.find({ type: 'Text', text: /^T-5 pick A$/ })).toBeFalsy()
  await pane.press({ key: 'tab-decisions' })
  await wait()
  expect((await pane.find({ type: 'Text', text: /^T-5 pick A$/ }))?.text).toBe('T-5 pick A')
  expect(await pane.find({ type: 'Button', key: 'decide' })).toBeTruthy()
  await pane.unmount()
})

test('pane: empty sections say so, and no decide Button without a decision', async ($, on) => {
  deskStub(on, { s: json() }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: /^none$/ }))?.text).toBe('none')
  expect(await pane.find({ type: 'Text', text: 'Pull requests' })).toBeFalsy() // prs null: unknown, not empty
  expect((await pane.find({ type: 'Text', text: /^unavailable$/ }))?.text).toBe('unavailable')
  await pane.press({ key: 'tab-decisions' })
  await wait()
  expect(await pane.find({ type: 'Button', key: 'decide' })).toBeFalsy()
  expect((await pane.find({ type: 'Text', text: /^No decisions waiting$/ }))?.text).toBeTruthy()
  await pane.press({ key: 'tab-todos' })
  await wait()
  expect((await pane.find({ type: 'Text', text: /^No open todos$/ }))?.text).toBeTruthy()
  await pane.unmount()
})

test('pane: every status field is on a tab', async ($, on) => {
  const head = 'a'.repeat(40)
  deskStub(on, { s: json({
    active: [{ id: 'T-9', title: 'do it', status: 'active', owner: 'abc', area: 'adesk', slug: 'x', state: 'built', next: 'review' }],
    claims: [{ slug: 'x', from: 'main', ts: '1970-01-01T00:00:00Z', last: '1970-01-01T00:00:00Z' }],
    branches: [{ slug: 'x', head, ci: 'CI aaaaaaa success', state: 'rebase', verdict: `MERGE @${head}`, behind: { base: 'develop', n: 2 } }],
    prs: [{ slug: 'x', number: 7, decision: 'CHANGES_REQUESTED', comments: 1, unresolved: 1, sinceHead: 0 }],
    overlaps: ['x + y: a.ts'], sessions: [{ session: 'abc', agents: [{ type: 'implementer/medium', about: 'Fix findings' }] }],
    roots: [{ id: 'kit', kind: 'git', path: '/k', gh: 'o/r', defaultBranch: 'develop', sha: head }, { id: 'notes', kind: 'folder', path: '/n' }],
    tokens: { calls: 3, fresh: 2000, cached: 1_500_000, out: 350 },
  }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'vscode' })
  const shown = async (text: RegExp) => expect((await pane.find({ type: 'Text', text }))?.text).toBeTruthy()
  await shown(/^T-9 do it$/)
  expect(await pane.find({ type: 'Text', text: /^wt:x$/ })).toBeFalsy() // under its branch's row: the slug once
  await shown(/^state: built$/)
  await shown(/^next: review$/)
  await shown(/^x ● rebase · main$/) // the claim's holder on the branch row
  await shown(/^behind develop by 2 · verdict MERGE @a{7}$/)
  expect(await pane.find({ type: 'Text', text: /· claimed / })).toBeFalsy() // that claim has a branch: no Trees row
  await shown(/#7 · review changes requested · 1 comment/)
  await shown(/^a\.ts · 2 branches$/)
  await shown(/^● abc$/)
  await shown(/^1 agent$/) // the id already names the row
  await shown(/^implementer\/medium · Fix findings$/)
  await shown(/^kit · develop @aaaaaaa · CI o\/r · \/k$/)
  await shown(/^notes · folder · \/n$/)
  await shown(/^3 calls · fresh 2k · cached 1\.5M · out 350$/)
  await shown(/^As of \d{4}-\d\d-\d\d \d\d:\d\dZ$/)
  await pane.unmount()
})

const H = 'a'.repeat(40), OK = 'CI aaaaaaa success'
const br = (b: Partial<DeskStatus['branches'][number]> = {}) => ({ slug: 'x', head: H, ci: OK, state: 'ready', verdict: `MERGE @${H}`, behind: null, ...b })

test('branchState: one word for each state, needing action before ready before in progress', () => {
  // The word is computed by the CLI (test/desk.test.mjs); the pane only colours and ranks it.
  const look = (state: string) => branchState(br({ state }))
  expect(look('ready')).toEqual({ word: 'ready', color: 'green', rank: 2 })
  expect(look('needs review')).toEqual({ word: 'needs review', color: 'orange', rank: 1 })
  expect(look('rebase')).toEqual({ word: 'rebase', color: 'orange', rank: 1 })
  expect(look('fixes needed')).toEqual({ word: 'fixes needed', color: 'red', rank: 0 })
  expect(look('CI failed')).toEqual({ word: 'CI failed', color: 'red', rank: 0 })
  for (const s of ['CI running', 'CI stale', 'no CI yet', 'CI unknown']) expect(look(s)).toEqual({ word: s, color: 'orange', rank: 3 })
  expect(look(undefined as unknown as string).word).toBe('CI unknown') // an older desk CLI sends no state
})

test('branchNote: a second line only when it adds something', () => {
  expect(branchNote(br())).toBe('')
  expect(branchNote(br({ verdict: null }))).toBe('')
  expect(branchNote(br({ state: 'fixes needed', verdict: `FIXES NEEDED @${H}` }))).toBe('')
  expect(branchNote(br({ state: 'needs review', verdictOld: true, verdict: `FIXES NEEDED @${'b'.repeat(40)}` }))).toBe('verdict FIXES NEEDED @bbbbbbb, older commit')
  expect(branchNote(br({ state: 'rebase', behind: { base: 'develop', n: 2 } }))).toBe(`behind develop by 2 · verdict MERGE @aaaaaaa`)
  expect(branchNote(br({ state: 'CI unknown', ci: 'CI unavailable', verdict: null }))).toBe('CI unavailable')
})

test('branchNote: the PR comes first, since a narrow pane cuts the end of the row', () => {
  const pr = (state: string) => ({ number: 7, state, url: 'https://github.example/o/r/pull/7' })
  expect(branchNote(br({ pr: pr('OPEN') }))).toBe('PR #7 open, a person merges')
  expect(branchNote(br({ pr: pr('OPEN') }), true)).toBe('') // the Pull requests card says it
  expect(branchNote(br({ pr: pr('MERGED') }), true)).toBe('PR #7 merged: desk wt merge x to close')
  expect(branchNote(br({ pr: pr('MERGED') }))).toBe('PR #7 merged: desk wt merge x to close')
  expect(branchNote(br({ pr: { ...pr('MERGED'), stale: true } }))).toBe('PR #7 merged')
  expect(branchNote(br({ pr: pr('CLOSED') }))).toBe('PR #7 closed unmerged')
  expect(branchNote(br({ state: 'rebase', pr: pr('OPEN'), behind: { base: 'develop', n: 2 } }))).toBe('PR #7 open, a person merges · behind develop by 2 · verdict MERGE @aaaaaaa')
  // A waiting PR is no failure: MERGE on the head stays green, whatever the PR says.
  expect(branchState(br({ pr: pr('OPEN') })).color).toBe('green')
})

test('pane: a review branch shows its PR and a review repo says so on Roots, both cut at the end', async ($, on) => {
  deskStub(on, { s: json({
    branches: [br({ slug: 'waits', pr: { number: 7, state: 'OPEN', url: 'https://github.example/o/r/pull/7' } })],
    roots: [{ id: 'kit', kind: 'git', path: '/k', gh: 'o/r', defaultBranch: 'develop', merge: 'review', sha: H }, { id: 'other', kind: 'git', path: '/o', defaultBranch: 'main', sha: H }],
  }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: /^PR #7 open, a person merges$/ }))?.props?.wrap).toBe('truncate-end')
  expect((await pane.find({ type: 'Text', text: /^kit · review · develop @aaaaaaa · CI o\/r · \/k$/ }))?.props?.wrap).toBe('truncate-end')
  expect(await pane.find({ type: 'Text', text: /^other · main @aaaaaaa · no CI · \/o$/ })).toBeTruthy() // a direct repo reads as before
  await pane.unmount()
})

test('headline: only the non-zero counts, coloured by the worst; nothing when all zero', () => {
  expect(headline([])).toBeNull()
  expect(headline([br({ state: 'no CI yet' })])).toBeNull() // in progress is not counted
  expect(headline([br(), br()])).toEqual({ text: '2 ready to merge', color: 'green' })
  expect(headline([br(), br({ state: 'needs review' }), br({ state: 'needs review' })])).toEqual({ text: '1 ready to merge · 2 need review', color: 'orange' })
  expect(headline([br({ state: 'needs review' })])?.text).toBe('1 needs review')
  expect(headline([br({ state: 'not pushed' })])).toEqual({ text: '1 not pushed', color: 'orange' })
  expect(headline([br(), br({ state: 'fixes needed' }), br({ state: 'CI failed' })])).toEqual({ text: '1 ready to merge · 1 fixes needed · 1 CI failed', color: 'red' })
})

test('overlapRows: grouped by file, most-contended first, tolerating the (+n) suffix', () => {
  expect(overlapRows([])).toEqual([])
  expect(overlapRows(['not an overlap line'])).toEqual([])
  expect(overlapRows(['a + b: README.md, z.ts (+3)', 'a + c: README.md', 'b + c: README.md, y.ts'])).toEqual([
    { file: 'README.md', n: 3 }, { file: 'y.ts', n: 2 }, { file: 'z.ts', n: 2 }])
})

test('pane: the Work tab at a glance', async ($, on) => {
  const b = 'b'.repeat(40)
  // The board and status name a session by the first 8 characters of its id; the engine answers the whole id.
  const me = '41499097'
  on('session.id', () => ({ value: `${me}-2738-4ac1-aadc-990e2e434603` }))
  deskStub(on, { s: json({
    claims: [{ slug: 'fix', from: me, ts: '1970-01-01T00:00:00Z', last: null }, { slug: 'ok', from: '1abf4323', ts: '1970-01-01T00:00:00Z', last: null }, { slug: 'loose', from: '6d9ac122', ts: '1970-01-01T00:00:00Z', last: null }],
    branches: [br({ slug: 'run', state: 'CI running', ci: 'CI aaaaaaa in_progress', verdict: null }), br({ slug: 'ok' }), br({ slug: 'fix', state: 'fixes needed', verdict: `FIXES NEEDED @${H}` }), br({ slug: 'old', state: 'needs review', verdictOld: true, verdict: `MERGE @${b}` })],
    overlaps: ['fix + ok: README.md, a.ts', 'fix + run: README.md, b.ts', 'ok + run: README.md, c.ts (+2)', 'ok + old: d.ts'],
    sessions: [
      { session: me, title: 'Agent-desk kickoff', slug: 'fix', agents: [{ type: 'implementer/medium', about: 'Fix findings' }, { type: 'reviewer/xhigh', about: '' }] },
      { session: '1abf4323', slug: 'ok', agents: [] },
      { session: '6d9ac122', agents: [] },
    ],
    roots: [{ id: 'kit', kind: 'git', path: '/k', defaultBranch: 'develop', sha: H }],
  }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'vscode' })
  const texts = async () => (await pane.findAll({ type: 'Text' })).map((t) => t.text)
  const top = await pane.find({ type: 'Text', text: /^1 ready to merge · 1 needs review · 1 fixes needed$/ })
  expect(top?.props?.color).toBe('red')

  const branches = await texts()
  const at = (re: RegExp) => branches.findIndex((t) => re.test(t))
  expect(at(/^fix ● fixes needed · Agent-desk kickoff$/)).toBeGreaterThan(-1)
  expect(at(/^old ● needs review$/)).toBeGreaterThan(at(/^fix ●/)) // action first
  expect(at(/^ok ● ready · 1abf4323$/)).toBeGreaterThan(at(/^old ●/)) // then ready; no title: the holder's id
  expect(at(/^run ● CI running$/)).toBeGreaterThan(at(/^ok ●/)) // in progress last
  expect(at(/^verdict MERGE @bbbbbbb, older commit$/)).toBeGreaterThan(-1)
  expect(at(/^loose · 6d9ac122 · claimed /)).toBeGreaterThan(-1) // only the claim with no branch keeps a row
  expect(at(/^ok · 1abf4323 · claimed /)).toBe(-1)
  expect(at(/^README\.md · 3 branches$/)).toBeGreaterThan(-1)
  expect(at(/^\+2 more$/)).toBeGreaterThan(-1)
  expect(branches.filter((t) => /· 2 branches$/.test(t)).length).toBe(2) // top three rows only

  const sessions = branches
  const has = (re: RegExp) => expect(sessions.some((t) => re.test(t))).toBe(true)
  has(/^● Agent-desk kickoff$/)
  has(new RegExp(`^${me} · 2 agents$`)) // its branch's row already names the slug
  has(/^implementer\/medium · Fix findings$/)
  has(/^reviewer\/xhigh$/)
  has(/^● 1abf4323$/) // no title: the id, though it has a slug (its branch row names that)
  has(/^● 6d9ac122$/)
  for (const id of ['1abf4323', '6d9ac122']) expect(sessions).not.toContain(id) // and no footnote repeating it
  expect(sessions.filter((t) => t === 'this session').length).toBe(1)
  expect(sessions.some((t) => /agent-desk(:|$)/.test(t))).toBe(false)
  const row = await pane.find({ type: 'Text', text: /^implementer\/medium/ })
  expect(row?.props?.wrap).toBe('truncate-end')
  await pane.unmount()
})

test('pane: a todo is one row, id and summary; no summary falls back to a truncated title', async ($, on) => {
  const long = 'a very long title '.repeat(10).trim()
  deskStub(on, { s: json({
    todos: [
      { id: 'T-1', title: 'the full title', summary: 'short glance', status: 'open', owner: 'abc' },
      { id: 'T-2', title: long, status: 'open', owner: 'abc', area: 'adesk', size: 'M', prio: 3, model: 'sonnet', slug: 'x', state: 's'.repeat(200), next: 'n'.repeat(200) },
      { id: 'T-3', title: 'bare', status: 'open' },
    ],
  }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await pane.press({ key: 'tab-todos' })
  await wait()
  expect((await pane.find({ type: 'Text', text: 'T-1 short glance' }))?.text).toBe('T-1 short glance')
  expect(await pane.find({ type: 'Text', text: /the full title/ })).toBeFalsy()
  const t2 = await pane.find({ type: 'Text', text: /^T-2 a very long/ })
  expect(t2?.props?.wrap).toBe('truncate-end') // one row: cut at the edge, never wrapped
  expect((await pane.find({ type: 'Text', text: 'wt:x' }))?.text).toBe('wt:x') // the label stays when the summary is long
  const boxes = await pane.findAll({ type: 'Box' })
  expect(boxes.find((b) => b.text === 'wt:x')?.props?.flexShrink).toBe(0) // the head is what gets cut, not the label
  expect(boxes.find((b) => b.text === `T-2 ${long}`)?.props?.flexShrink).toBe(1)
  expect((await pane.find({ type: 'Text', text: 'abc' }))?.text).toBe('abc') // no slug: the owner (T-1)
  for (const gone of [/adesk/, /sonnet/, /^p3$/, /^M$/]) expect(await pane.find({ type: 'Text', text: gone })).toBeFalsy() // no model, area, size, prio
  expect(await pane.find({ type: 'Text', text: /^T-3 bare$/ })).toBeTruthy()
  expect((await pane.find({ type: 'Text', text: /^state: s/ }))?.props?.wrap).toBe('truncate-end')
  expect((await pane.find({ type: 'Text', text: /^next: n/ }))?.props?.wrap).toBe('truncate-end')
  await pane.unmount()
})

test('pane: a todo labels itself with its status and area, slug or owner', async ($, on) => {
  deskStub(on, { s: json({ todos: [
    { id: 'T-3', title: 'bare', status: 'open', area: 'adesk', size: 'M' },
    { id: 'T-4', title: 'held', status: 'blocked', area: 'adesk', owner: 'abc' },
    { id: 'T-5', title: 'loose', status: 'active' },
  ] }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await pane.press({ key: 'tab-todos' })
  await wait()
  expect((await pane.find({ type: 'Text', text: /^T-3 bare$/ }))?.text).toBe('T-3 bare')
  expect((await pane.find({ type: 'Text', text: /^adesk$/ }))?.text).toBe('adesk')
  expect((await pane.find({ type: 'Text', text: /^blocked · abc$/ }))?.text).toBe('blocked · abc')
  expect((await pane.find({ type: 'Text', text: /^active$/ }))?.text).toBe('active')
  for (const gone of [/^wt:/, /^M$/]) expect(await pane.find({ type: 'Text', text: gone })).toBeFalsy()
  await pane.unmount()
})

test('pane: a todo on a branch shows under Work and not again under Todos', async ($, on) => {
  const onBranch = { id: 'T-9', title: 'on the branch', status: 'active', slug: 'x', area: 'adesk' }
  deskStub(on, { s: json({ active: [onBranch], todos: [{ id: 'T-10', title: 'not started', status: 'open', area: 'adesk' }], branches: [cleanBranch] }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ key: 'tab-work' }))?.text).toBe('Work 1')
  expect((await pane.find({ key: 'tab-todos' }))?.text).toBe('Todos 1')
  expect(await pane.find({ type: 'Text', text: /^T-9 on the branch$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^T-10/ })).toBeFalsy()
  await pane.press({ key: 'tab-todos' })
  await wait()
  expect(await pane.find({ type: 'Text', text: /^T-10 not started$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^T-9/ })).toBeFalsy()
  await pane.unmount()
})

test('pane: a blocked todo with a slug is under Todos, not Work: only an active todo sits on its branch', async ($, on) => {
  deskStub(on, { s: json({ todos: [{ id: 'T-7', title: 'held up', status: 'blocked', area: 'adesk', slug: 'x' }], branches: [cleanBranch] }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^T-7/ })).toBeFalsy()
  await pane.press({ key: 'tab-todos' })
  await wait()
  expect(await pane.find({ type: 'Text', text: /^T-7 held up$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^blocked · wt:x$/ })).toBeTruthy()
  await pane.unmount()
})

test('pane: an active todo that status sorts first is within the ten, not behind +n more', async ($, on) => {
  const todos = [{ id: 'T-40', title: 'in hand', status: 'active' }, ...Array.from({ length: 12 }, (_, i) => ({ id: `T-${i + 1}`, title: `t${i + 1}`, status: 'open' }))]
  deskStub(on, { s: json({ todos }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-todos' })
  await wait()
  expect(await pane.find({ type: 'Text', text: /^T-40 in hand$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^\+3 more$/ })).toBeTruthy()
  await pane.unmount()
})

test('pane: an open PR shows once, on the Pull requests card, which says a person merges', async ($, on) => {
  const pr = { number: 7, state: 'OPEN', url: 'https://github.example/o/r/pull/7' }
  deskStub(on, { s: json({
    branches: [cleanBranch, { ...cleanBranch, slug: 'y', pr: { ...pr, state: 'MERGED' } }].map((b, i) => (i ? b : { ...b, pr })),
    prs: [{ slug: 'x', number: 7, decision: 'APPROVED', comments: 0, unresolved: 0, sinceHead: 0 }],
  }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const texts = (await pane.findAll({ type: 'Text' })).map((t) => t.text ?? '')
  expect(texts.filter((t) => /#7/.test(t) && !/merged/.test(t))).toEqual(['x #7 · review approved · 0 comment(s) · 0 unresolved · 0 new since the head commit · a person merges'])
  expect(texts.filter((t) => /a person merges/.test(t)).length).toBe(1)
  expect(texts).toContain('PR #7 merged: desk wt merge y to close') // only the open note moves
  await pane.unmount()
})

test('pane: the Decisions tab shows each option and its why; a decision without options still shows', async ($, on) => {
  const decisions = [
    { id: 'T-5', title: 'pick A', options: [{ label: 'keep', why: 'it works' }, { label: 'drop' }] },
    { id: 'T-6', title: 'pick B' },
  ]
  deskStub(on, { s: json({ decisions }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-decisions' })
  await wait()
  expect(await pane.find({ type: 'Text', text: /^Recommended: keep · it works$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^Or: drop$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^T-6 pick B$/ })).toBeTruthy()
  expect((await pane.find({ type: 'Button', key: 'decide' }))?.text).toBe('Decide (2)')
  await pane.unmount()
})

test('pane: Todos keep the order given, past ten a count of the rest', async ($, on) => {
  // status --json puts an active todo first, so the cut never hides it: the pane keeps that order.
  const todos = Array.from({ length: 13 }, (_, i) => ({ id: `T-${i + 1}`, title: `t${i + 1}`, status: i ? 'open' : 'active' }))
  deskStub(on, { s: json({ todos }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ key: 'tab-todos' }))?.text).toBe('Todos 13')
  await pane.press({ key: 'tab-todos' })
  await wait()
  const rows = (await pane.findAll({ type: 'Text' })).map((t) => t.text).filter((t) => /^T-\d+ /.test(t ?? ''))
  expect(rows).toEqual(todos.slice(0, 10).map((x) => `${x.id} ${x.title}`))
  expect(await pane.find({ type: 'Text', text: /^\+3 more$/ })).toBeTruthy()
  await pane.unmount()
})

test('pane: a label wider than the pane is cut too', async ($, on) => {
  deskStub(on, { s: json({ todos: [{ id: 'T-1', title: 't', status: 'open', slug: 'row-meta' }] }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const flexShrink = async (bodyColumns: number) => {
    const pane = await $.ui.mount({ ...PANE, surface: 'vscode', props: { ...PANE.props, bodyColumns } })
    await pane.press({ key: 'tab-todos' })
    await wait()
    const label = (await pane.findAll({ type: 'Box' })).find((b) => b.text === 'wt:row-meta') // 11 columns
    await pane.unmount()
    return label?.props?.flexShrink
  }
  expect(await flexShrink(16)).toBe(0) // 11 + 4 for the card + 1 for the gap
  expect(await flexShrink(15)).toBe(1)
})

const cleanBranch = { slug: 'x', head: 'a'.repeat(40), ci: 'CI aaaaaaa success', state: 'ready', verdict: `MERGE @${'a'.repeat(40)}`, behind: null }

test('pane: the Work tab marks a failing branch, seen from any tab', async ($, on) => {
  deskStub(on, { s: json({ branches: [{ ...cleanBranch, ci: 'CI aaaaaaa failure', state: 'CI failed' }] }) }, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: '●' }))?.props?.color).toBe('red')
  expect((await pane.findAll({ type: 'Box' })).find((b) => b.text?.startsWith('Open branches'))?.props?.borderColor).toBe('red')
  await pane.press({ key: 'tab-todos' })
  await wait()
  expect((await pane.find({ type: 'Text', text: '●' }))?.props?.color).toBe('red')
  await pane.unmount()
})

for (const [name, branches, border] of [
  ['all is well', [cleanBranch], { borderColor: 'green' }],
  ['a branch is in progress', [{ ...cleanBranch, state: 'needs review', verdict: null }], { borderColor: 'orange' }],
  ['there are no branches', [], { borderDimColor: true }],
] as const) {
  test(`pane: no mark on the Work tab while ${name}`, async ($, on) => {
    deskStub(on, { s: json({ branches: [...branches] }) }, [])
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await wait()
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect((await pane.findAll({ type: 'Box' })).find((b) => b.text?.startsWith('Open branches'))?.props).toMatchObject(border)
    await pane.press({ key: 'tab-todos' }) // the Work tab's own rows carry dots
    await wait()
    expect(await pane.find({ type: 'Button', key: 'tab-work' })).toBeTruthy() // the status loaded: an absent dot means something
    expect(await pane.find({ type: 'Text', text: '●' })).toBeFalsy()
    await pane.unmount()
  })
}

test('pane: status colours for quota, pull requests and card borders', () => {
  const window = (pct: number) => ({ name: '5h', pct, until: null })
  expect(quotaColor({ rows: [window(10), window(85)], tail: '' })).toBe('red') // the highest window decides
  expect(quotaColor({ rows: [window(60)], tail: '' })).toBe('orange')
  expect(quotaColor({ rows: [], tail: '' })).toBe('green')
  const pr = { slug: 'x', number: 1, comments: 0, unresolved: 0, sinceHead: 0 }
  expect(prColor({ ...pr, decision: 'CHANGES_REQUESTED' })).toBe('red')
  expect(prColor({ ...pr, decision: 'APPROVED' })).toBe('green')
  expect(prColor({ ...pr, decision: 'APPROVED', unresolved: 1 })).toBe('orange')
  expect(prColor({ ...pr, decision: 'APPROVED', sinceHead: 1 })).toBe('orange')
  expect(prColor({ ...pr, decision: 'REVIEW_REQUIRED' })).toBe('orange')
  expect(worst(['green', undefined, 'orange', 'red'])).toBe('red')
  expect(worst(['green', 'orange'])).toBe('orange')
  expect(worst([undefined])).toBeUndefined()
  expect(branchColor(cleanBranch)).toBe('green')
  expect(branchColor({ ...cleanBranch, state: 'rebase' })).toBe('orange')
  expect(branchColor({ ...cleanBranch, state: 'CI failed' })).toBe('red')
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
  await $.command.run({ command: 'decide', args: 'T-5 take A', ...RUN })
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

const statusRuns = (argv: string[][]) => argv.filter((a) => a[2] === 'status').map((a) => a.slice(3).join(' '))

test('pane: a look runs --cached once per change, and leaves the plain run to the minute', async ($, on) => {
  const argv: string[][] = [], looks: (() => void)[] = [], ticks: (() => void)[] = [], stats: string[] = []
  const file = { size: 1 }
  deskStub(on, { s: json() }, argv, 0, { looks, ticks, homePath: 'C:/desk\n' })
  on('fs.stat', (_$, e) => { stats.push(e.path); return { value: { kind: 'file', size: file.size, mtimeMs: 5, isLink: false } } })
  const fire = async (fns: (() => void)[]) => { for (const run of fns.splice(0)) run(); await wait() }
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  expect(statusRuns(argv)).toEqual(['--json'])
  await fire(looks)
  expect(statusRuns(argv)).toEqual(['--json']) // nothing changed since the start
  // Off Windows, "C:/desk" is a relative path and the harness puts the working folder in front of it.
  expect(stats.slice(0, 3).map((p) => p.replaceAll('\\', '/').replace(/^.*C:\/desk\//, ''))).toEqual(['todo.jsonl', 'board.jsonl', 'decisions.jsonl'])
  file.size = 2
  await fire(looks)
  expect(statusRuns(argv)).toEqual(['--json', '--cached --json'])
  await fire(looks)
  expect(statusRuns(argv)).toEqual(['--json', '--cached --json'])
  await fire(ticks)
  expect(statusRuns(argv)).toEqual(['--json', '--cached --json', '--json'])
})

test('pane: no desk path means no look', async ($, on) => {
  const argv: string[][] = [], looks: (() => void)[] = [], stats: string[] = []
  deskStub(on, { s: json() }, argv, 0, { looks })
  on('fs.stat', (_$, e) => { stats.push(e.path); throw new Error('no') })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  for (const run of looks.splice(0)) run()
  await wait()
  expect(stats).toEqual([])
  expect(statusRuns(argv)).toEqual(['--json'])
})

test('pane: a missing file does not run status on every look', async ($, on) => {
  const argv: string[][] = [], looks: (() => void)[] = []
  deskStub(on, { s: json() }, argv, 0, { looks, homePath: 'C:/desk\n' })
  on('fs.stat', () => { throw new Error('ENOENT') })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  for (let i = 0; i < 2; i++) { for (const run of looks.splice(0)) run(); await wait() }
  expect(statusRuns(argv)).toEqual(['--json'])
})

test('pane: one run at a time; requests meanwhile make one more, plain if any was plain', async ($, on) => {
  const argv: string[][] = [], ticks: (() => void)[] = [], gates: (() => void)[] = []
  deskStub(on, { s: json() }, argv, 0, { ticks, hold: () => new Promise((r) => gates.push(r)) })
  const release = async () => { gates.shift()?.(); await wait() }
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  // A ruling alone: the run after it stays cached.
  await $.command.run({ command: 'decide', args: 'T-5 take A', ...RUN })
  await $.command.run({ command: 'decide', args: 'T-6 take B', ...RUN })
  expect(statusRuns(argv)).toEqual(['--json'])
  await release()
  expect(statusRuns(argv)).toEqual(['--json', '--cached --json'])
  // A ruling and the minute together: one run, the plain one, so the minute's gh round is not lost.
  await $.command.run({ command: 'decide', args: 'T-7 take C', ...RUN })
  for (const run of ticks.splice(0)) run()
  await wait()
  expect(statusRuns(argv)).toEqual(['--json', '--cached --json'])
  await release()
  expect(statusRuns(argv)).toEqual(['--json', '--cached --json', '--json'])
  await release()
  expect(statusRuns(argv)).toEqual(['--json', '--cached --json', '--json'])
})

test('/decide passes the id and the ruling as two argv elements', async ($, on) => {
  const argv: string[][] = []
  deskStub(on, { s: '' }, argv)
  const r = await $.command.run({ command: 'decide', args: '  T-5 take A; "quoted" too ', ...RUN })
  expect(argv.at(-2)?.slice(2)).toEqual(['decide', 'T-5', 'take A; "quoted" too'])
  expect(argv.at(-1)?.slice(2)).toEqual(['status', '--cached', '--json']) // a ruling is local: no gh round for it
  expect(r.text).toBe('Recorded T-5: take A')
  await $.command.run({ command: 'decide', args: '', ...RUN })
  expect(argv.at(-1)?.slice(2)).toEqual(['decide'])
  await $.command.run({ command: 'decide', args: '--list 5', ...RUN })
  expect(argv.at(-1)?.slice(2)).toEqual(['decide', '--list', '5'])
})

test('/decide T-n --pick ... splits for the CLI, so it refuses a mistyped value; other text stays one argument', async ($, on) => {
  const argv: string[][] = []
  deskStub(on, { s: '' }, argv)
  const sent = async (args: string) => {
    await $.command.run({ command: 'decide', args, ...RUN })
    return argv.at(-2)?.slice(2)
  }
  expect(await sent('T-5 --pick 2')).toEqual(['decide', 'T-5', '--pick', '2'])
  expect(await sent('  T-5   --pick   2 ')).toEqual(['decide', 'T-5', '--pick', '2'])
  expect(await sent('T-5 --pick 2 please')).toEqual(['decide', 'T-5', '--pick', '2', 'please'])
  expect(await sent('T-5 --pick two')).toEqual(['decide', 'T-5', '--pick', 'two'])
  expect(await sent('T-5 --pick <2>')).toEqual(['decide', 'T-5', '--pick', '<2>'])
  expect(await sent('T-5 --pick')).toEqual(['decide', 'T-5', '--pick'])
  expect(await sent('T-5 --picky choice')).toEqual(['decide', 'T-5', '--picky choice'])
  expect(await sent('T-5 use --pick 2')).toEqual(['decide', 'T-5', 'use --pick 2'])
  // One argument, so the CLI refuses it (it cannot tell it from a label); the mod must not split or reword it.
  expect(await sent('T-5 --pick=2')).toEqual(['decide', 'T-5', '--pick=2'])
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

test('pane: two waiting: the band reads the count and the Button, no ctx row', async ($, on) => {
  deskStub(on, { s: json({ decisions: TWO }) }, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 100, window: 1000, percent: 10 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const ui = await $.ui.mount(BAND('terminal'))
  expect((await ui.find({ type: 'Text', text: /waiting/ }))?.text).toBe('⚑ 2 decisions waiting ')
  expect((await ui.find({ type: 'Button', key: 'decide' }))?.text).toBe('Decide (2)')
  expect(await ui.find({ type: 'Text', text: /near full/ })).toBeFalsy()
  await ui.unmount()
})

test('pane: near full only: the band reads the ctx row, no Button', async ($, on) => {
  deskStub(on, { s: json() }, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 840, window: 1000, percent: 84 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const ui = await $.ui.mount(BAND('terminal'))
  expect((await ui.find({ type: 'Text', text: /near full/ }))?.text).toBe('ctx ▰▰▰▰▰▰▰▱ 84%  near full: handoff or /compact')
  expect(await ui.find({ type: 'Button', key: 'decide' })).toBeFalsy()
  await ui.unmount()
})

// What `desk decide --json` prints: test/units.test.mjs and test/desk.test.mjs pin that shape. A hooks test cannot import bin/desk.mjs.
const printed = (id: string, options: (string | { label: string; why?: string })[], title = 'pick', context: string | null = null) =>
  `${JSON.stringify({ id, title, context, options: options.map((o) => (typeof o === 'string' ? { label: o } : o)) })}\n`
const NONE = 'null\n'
const REC = 'Recorded\n' // what a record prints; the walk reads the next decision with --json instead
const KD = ['(a) keep', '(b) drop']
const REFUSED = { exitCode: 1, stdout: '', stderr: 'decide: T-5 is not a waiting owner decision, or the ruling is empty\n' }

type Print = string | Error | { exitCode: number; stdout: string; stderr: string }
type Answer = string | { deny: string } | (() => unknown)
// A press with only the plugin's own hooks answering /decide: `prints` are desk decide's replies in order, `answers` the dialog's.
function pressStub(on: On, prints: Print[], answers: Answer[] = [], draft = '') {
  const d = { status: { s: json({ decisions: TWO }) }, argv: [] as string[][], asks: [] as { question: string; choices: string[] }[], toasts: [] as string[], filled: [] as string[] }
  deskStub(on, d.status, d.argv, 0, {
    decide: () => {
      const p = prints.shift() ?? ''
      if (p instanceof Error) throw p
      return typeof p === 'string' ? { stdout: p } : p
    },
  })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$, e) => {
    const q = e.questions[0]!
    d.asks.push({ question: q.question, choices: q.options.map((o) => o.label) })
    const x = answers.shift()
    const a = await (typeof x === 'function' ? x() : x)
    return (typeof a === 'string' ? { result: { answers: { [q.question]: a } } } : a) as never
  })
  on('ui.toast', (_$, e) => { d.toasts.push(e.text); return { value: undefined } as never })
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }) as never)
  on('prompt.fill', (_$, e) => { d.filled.push(e.text); return { isFilled: true } as never })
  return d
}
const decides = (d: { argv: string[][] }) => d.argv.filter((a) => a[2] === 'decide').map((a) => a.slice(3))

// A typed /decide with no args: the Decide Button's dialog walk where a surface draws, the old text where none does.
const typedDecide = async ($: Parameters<TestBody>[0], on: On, d: { toasts: string[] }, surface = true) => {
  if (surface) {
    on('session.surfaces', () => ({ value: ['terminal'] }) as never)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  }
  await wait()
  const r = await $.command.run({ command: 'decide', args: '', ...RUN })
  for (let i = 0; i < 20 && !d.toasts.length; i++) await wait()
  await wait()
  return r
}

test('typed /decide: opens the dialog, says the way out, and records the answer', async ($, on) => {
  const d = pressStub(on, [printed('T-5', KD), printed('T-5', KD), REC, NONE], ['(b) drop'])
  const r = await typedDecide($, on, d)
  expect(r.text).toBe('Decisions: answer in the dialog. If none opens, use /decide T-n <ruling> or desk decide.')
  expect(d.asks).toHaveLength(1)
  expect(decides(d)).toEqual([['--json'], ['--json'], ['T-5', '(b) drop'], ['--json']])
})

test('typed /decide: a closed dialog records nothing and toasts nothing', async ($, on) => {
  const d = pressStub(on, [printed('T-5', KD), printed('T-5', KD)], [{ deny: 'the owner closed it' }])
  await typedDecide($, on, d)
  await wait()
  expect(decides(d)).toEqual([['--json'], ['--json']])
  expect(d.toasts).toEqual([])
})

test('typed /decide: none waiting prints that and opens no dialog', async ($, on) => {
  const d = pressStub(on, [NONE, 'No owner decisions waiting.\n'])
  const r = await typedDecide($, on, d)
  expect(r.text).toBe('No owner decisions waiting.')
  expect(d.asks).toEqual([])
  expect(decides(d)).toEqual([['--json'], []])
})

for (const options of [['only'], ['a', 'b', 'c', 'd', 'e']]) {
  test(`typed /decide: ${options.length} option(s) stay on screen as text, no dialog`, async ($, on) => {
    const text = `T-5 (1 of 1): pick\n  ${options.map((o) => `Or: ${o}\n    its why`).join('\n  ')}\n`
    const d = pressStub(on, [printed('T-5', options), text])
    const r = await typedDecide($, on, d)
    expect(r.text).toBe(text.trim())
    expect(d.asks).toEqual([])
    expect(d.toasts).toEqual([])
    expect(d.filled).toEqual([])
    expect(decides(d)).toEqual([['--json'], []])
  })
}

for (const [what, reply] of [['unparsable', 'not json\n'], ['refused', REFUSED]] as const) {
  test(`typed /decide: a ${what} --json read falls through to the text`, async ($, on) => {
    const d = pressStub(on, [reply, 'T-5 (1 of 1): printed by an older desk\n'])
    const r = await typedDecide($, on, d)
    expect(r.text).toBe('T-5 (1 of 1): printed by an older desk')
    expect(d.asks).toEqual([])
  })
}

test('typed /decide: no surface to draw on gives the printed text and no dialog', async ($, on) => {
  const d = pressStub(on, ['T-5 (1 of 1): pick\n'])
  const r = await typedDecide($, on, d, false)
  expect(d.asks).toEqual([])
  expect(decides(d)).toEqual([[]])
  expect(r.text).toContain('T-5')
})

for (const [where, site] of [['band', BAND('terminal')], ['pane', { ...PANE, surface: 'terminal' }]] as const) {
  type Driver = Parameters<TestBody>[0]
  // The pane's Button is on its Decisions tab.
  const mount = async ($: Driver) => {
    const ui = await $.ui.mount(site)
    if (where === 'pane') { await ui.press({ key: 'tab-decisions' }); await wait() }
    return ui
  }
  // Every walk but a silent one ends in a toast, and a fill follows its toast.
  const press = async ($: Driver, d: { toasts: string[] }) => {
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await wait()
    const ui = await mount($)
    expect((await ui.find({ type: 'Button', key: 'decide' }))?.text).toBe('Decide (2)')
    await ui.press({ key: 'decide' })
    for (let i = 0; i < 20 && !d.toasts.length; i++) await wait()
    await wait()
    await ui.unmount()
  }

  test(`${where} press: only the plugin answers: desk decide runs`, async ($, on) => {
    const d = pressStub(on, [NONE])
    await press($, d)
    expect(decides(d)).toEqual([['--json']])
  })

  test(`${where} press: an old todo's rationale is visible in the question, and only the short label is recorded (T-151)`, async ($, on) => {
    const options = [
      { label: 'Refuse', why: 'a hidden push cannot slip through, at the cost of rare false refusals' },
      { label: 'Allow as before', why: 'no false refusals, but an unparseable line can hide a push from this guard' },
    ]
    const d = pressStub(on, [printed('T-151', options, 'A push the guard cannot parse', 'From the merge-policy review'), REC, NONE], ['Refuse'])
    await press($, d)
    const q = d.asks[0]!.question
    expect(q).toContain('T-151: A push the guard cannot parse')
    expect(q).toContain('From the merge-policy review')
    expect(q).toContain(`Recommended: Refuse - ${options[0]!.why}`)
    expect(q).toContain(`Or: Allow as before - ${options[1]!.why}`)
    expect(d.asks[0]!.choices).toEqual(['Refuse', 'Allow as before'])
    expect(decides(d)).toEqual([['--json'], ['T-151', 'Refuse'], ['--json']])
  })

  test(`${where} press: output that is not JSON: a toast, no dialog, nothing recorded`, async ($, on) => {
    const d = pressStub(on, ['T-5 (1 of 1): printed by an older desk\n'])
    await press($, d)
    expect(d.asks).toEqual([])
    expect(d.toasts).toHaveLength(1)
    expect(decides(d)).toEqual([['--json']])
  })

  test(`${where} press: asks and records the chosen label, and the pane refreshes`, async ($, on) => {
    const d = pressStub(on, [printed('T-5', KD, 'pick A'), REC, NONE], ['(b) drop'])
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await wait()
    d.status.s = json({ decisions: [{ id: 'T-6', title: 'pick B' }] }) // from here only a refresh can show T-6
    const ui = await mount($)
    await ui.press({ key: 'decide' })
    for (let i = 0; i < 20 && !d.toasts.length; i++) await wait()
    await wait()
    await ui.unmount()
    expect(d.asks).toHaveLength(1)
    expect(d.asks[0]!.question).toContain('T-5: pick A')
    expect(d.asks[0]!.question).toContain('Recommended: (a) keep')
    expect(d.asks[0]!.choices).toEqual(KD)
    expect(decides(d)).toEqual([['--json'], ['T-5', '(b) drop'], ['--json']])
    const again = await mount($)
    expect((await again.find({ type: 'Button', key: 'decide' }))?.text).toBe('Decide (1)')
    await again.unmount()
  })

  test(`${where} press: records typed text`, async ($, on) => {
    const d = pressStub(on, [printed('T-5', KD), REC, NONE], ['neither, wait for v0.4'])
    await press($, d)
    expect(decides(d)).toEqual([['--json'], ['T-5', 'neither, wait for v0.4'], ['--json']])
  })

  test(`${where} press: a clicked label reading like --pick goes as one argument`, async ($, on) => {
    const d = pressStub(on, [printed('T-5', ['Keep', '--pick 1']), REC, NONE], ['--pick 1'])
    await press($, d)
    expect(decides(d)).toEqual([['--json'], ['T-5', '--pick 1'], ['--json']])
  })

  test(`${where} press: a picked label is recorded as it is; the same text typed under Other is scrubbed`, async ($, on) => {
    const label = `ask jdoe@${'realcorp.io'} first`
    const d = pressStub(on, [printed('T-5', [label, 'Drop']), REC, printed('T-6', ['Keep', 'Drop']), REC, NONE], [label, label])
    await press($, d)
    expect(decides(d)[1]).toEqual(['T-5', label])
    expect(decides(d)[3]![1]).toMatch(/^ask \[REDACTED-EMAIL-[0-9a-f]{8}\] first$/)
  })

  test(`${where} press: a secret in the answer is not recorded`, async ($, on) => {
    const key = `${'gh' + 'p_'}${'aB3dE6gH9k'.repeat(4).slice(0, 36)}`
    const d = pressStub(on, [printed('T-5', KD), REC, NONE], [`use ${key}`])
    await press($, d)
    const ruling = decides(d).at(-2)![1]!
    expect(ruling.includes(key)).toBe(false)
    expect(ruling).toMatch(/^use \[REDACTED-SECRET-[0-9a-f]{8}\]$/)
  })

  test(`${where} press: a masked typed answer toasts without the secret (T-163)`, async ($, on) => {
    const key = `${'gh' + 'p_'}${'aB3dE6gH9k'.repeat(4).slice(0, 36)}`
    const d = pressStub(on, [printed('T-5', KD), REC, NONE], [`use ${key}`])
    await press($, d)
    const toast = d.toasts.find((t) => /masked/.test(t))
    expect(toast).toBeDefined()
    expect(toast!.includes(key)).toBe(false)
    expect(toast!.includes('use ')).toBe(false)
  })

  test(`${where} press: a masked answer the CLI refuses shows only the refusal (T-163)`, async ($, on) => {
    const key = `${'gh' + 'p_'}${'aB3dE6gH9k'.repeat(4).slice(0, 36)}`
    const d = pressStub(on, [printed('T-5', KD), REFUSED], [`use ${key}`])
    await press($, d)
    expect(d.toasts).toEqual([REFUSED.stderr.trim()])
  })

  test(`${where} press: an unchanged typed answer shows no masked toast (T-163)`, async ($, on) => {
    const d = pressStub(on, [printed('T-5', KD), REC, NONE], ['neither, wait for v0.4'])
    await press($, d)
    expect(d.toasts.some((t) => /masked/.test(t))).toBe(false)
  })

  test(`${where} press: a long option reaches the dialog and the record whole`, async ($, on) => {
    const long = `(a) ${'keep the long way round '.repeat(20).trim()}`
    const d = pressStub(on, [printed('T-5', [long, '(b) drop']), REC, NONE], [long])
    await press($, d)
    expect(d.asks[0]!.choices[0]).toBe(long)
    expect(decides(d).at(-2)).toEqual(['T-5', long])
  })

  test(`${where} press: walks on to the next waiting decision, and ends with a toast`, async ($, on) => {
    const d = pressStub(on, [
      printed('T-5', KD),
      REC,
      printed('T-6', ['(c) now', '(d) later'], 'pick B'),
      REC,
      NONE,
    ], ['(a) keep', '(d) later'])
    await press($, d)
    expect(d.asks.map((a) => a.choices)).toEqual([KD, ['(c) now', '(d) later']])
    expect(d.asks[1]!.question).toContain('T-6: pick B')
    expect(decides(d)).toEqual([['--json'], ['T-5', '(a) keep'], ['--json'], ['T-6', '(d) later'], ['--json']])
    expect(d.toasts.at(-1)).toContain('No owner decisions waiting.')
    expect(d.toasts).toHaveLength(1)
  })

  test(`${where} press: with a draft, the ruling is recorded and the draft stays`, async ($, on) => {
    const d = pressStub(on, [printed('T-5', KD), REC, NONE], ['(a) keep'], 'half typed')
    await press($, d)
    expect(decides(d).at(-2)).toEqual(['T-5', '(a) keep'])
    expect(d.filled).toEqual([])
  })

  test(`${where} press: declined: nothing recorded or filled, a toast of the reason, no next question`, async ($, on) => {
    const d = pressStub(on, [printed('T-5', KD)], [{ deny: 'the owner closed it' }])
    await press($, d)
    expect(decides(d)).toEqual([['--json']])
    expect(d.filled).toEqual([])
    expect(d.asks).toHaveLength(1)
    expect(d.toasts.join('\n')).toContain('the owner closed it')
  })

  test(`${where} press: ruled elsewhere: the refusal is the toast and the walk ends`, async ($, on) => {
    const d = pressStub(on, [printed('T-5', KD), REFUSED], ['(a) keep'])
    await press($, d)
    expect(d.toasts).toEqual([REFUSED.stderr.trim()])
    expect(d.asks).toHaveLength(1)
    expect(d.filled).toEqual([])
  })

  for (const [what, options] of [['no options', []], ['five options', ['a', 'b', 'c', 'd', 'e']], ['one option', ['a']]] as const) {
    test(`${where} press: ${what}, empty prompt: a toast, no dialog, the prompt holds /decide T-5`, async ($, on) => {
      const d = pressStub(on, [printed('T-5', [...options])])
      await press($, d)
      expect(d.toasts).toHaveLength(1)
      expect(d.toasts[0]).toContain('T-5: pick')
      expect(d.toasts[0]).toContain('Answer: /decide T-5 <ruling>')
      expect(d.asks).toEqual([])
      expect(d.filled).toEqual(['/decide T-5 '])
    })

    test(`${where} press: ${what}, a draft: a toast and the draft stays`, async ($, on) => {
      const d = pressStub(on, [printed('T-5', [...options])], [], 'half typed')
      await press($, d)
      expect(d.toasts).toHaveLength(1)
      expect(d.filled).toEqual([])
    })
  }

  test(`${where} press: nothing printed: no dialog, nothing filled`, async ($, on) => {
    const d = pressStub(on, [NONE])
    await press($, d)
    expect(d.asks).toEqual([])
    expect(d.filled).toEqual([])
    expect(d.toasts).toEqual(['No owner decisions waiting.'])
  })

  test(`${where} press: desk decide printing nothing, or failing to start: no dialog, no stuck guard`, async ($, on) => {
    const d = pressStub(on, ['', new Error('spawn failed')])
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await wait()
    const ui = await mount($)
    await ui.press({ key: 'decide' })
    await wait()
    expect(d.toasts).toEqual([])
    await ui.press({ key: 'decide' })
    for (let i = 0; i < 20 && !d.toasts.length; i++) await wait()
    await ui.unmount()
    expect(d.toasts[0]).toContain('desk decide failed')
    expect(d.asks).toEqual([])
  })

  test(`${where} press: a newer id than the status's: the one read fresh is asked and ruled`, async ($, on) => {
    const d = pressStub(on, [printed('T-60', KD, 'newer'), REC, NONE], ['(a) keep'])
    await press($, d)
    expect(d.asks[0]!.question).toContain('T-60: newer')
    expect(decides(d)).toEqual([['--json'], ['T-60', '(a) keep'], ['--json']])
  })

  test(`${where} press: a second press while the dialog is open does nothing`, async ($, on) => {
    let settle = (_: string) => {}
    const d = pressStub(on, [printed('T-5', KD), REC, NONE], [() => new Promise<string>((r) => { settle = r })])
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await wait()
    const ui = await mount($)
    await ui.press({ key: 'decide' })
    for (let i = 0; i < 20 && !d.asks.length; i++) await wait()
    await ui.press({ key: 'decide' })
    await wait()
    expect(d.asks).toHaveLength(1)
    expect(decides(d)).toEqual([['--json']])
    settle('(a) keep')
    for (let i = 0; i < 20 && !d.toasts.length; i++) await wait()
    await ui.unmount()
    expect(decides(d)).toEqual([['--json'], ['T-5', '(a) keep'], ['--json']])
  })

  for (const [how, failure] of [['declined', { deny: 'closed' }], ['thrown', () => { throw new Error('boom') }]] as const) {
    test(`${where} press: after a walk ended by a ${how} dialog, the Button asks again`, async ($, on) => {
      const d = pressStub(on, [printed('T-5', KD), printed('T-5', KD), REC, NONE], [failure, '(a) keep'])
      await press($, d)
      expect(d.toasts).toHaveLength(1)
      d.toasts.length = 0
      const ui = await mount($)
      await ui.press({ key: 'decide' })
      for (let i = 0; i < 20 && !d.toasts.length; i++) await wait()
      await ui.unmount()
      expect(d.asks).toHaveLength(2)
      expect(decides(d).at(-2)).toEqual(['T-5', '(a) keep'])
    })
  }
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

test('pane: this session\'s agents show once, from the engine when it lists them', async ($, on) => {
  const ticks: (() => void)[] = []
  on('session.id', () => ({ value: 'aaaaaaaa-0000-0000-0000-000000000000' }))
  deskStub(on, { s: json({ sessions: [
    { session: 'aaaaaaaa', agents: [{ type: 'reviewer/xhigh', about: 'look' }] },
    { session: 'bbbbbbbb', agents: [{ type: 'reviewer/xhigh', about: 'other' }] },
  ] }) }, [], 0, { ticks, clock: { t: 0 } })
  on('agent.list', () => ({ value: [{ id: 'a1', type: 'reviewer', description: 'look live', status: 'running' }] }) as never)
  on('model.fork', () => ({ value: { isAnswered: true, text: 'ok' } }) as never)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  for (const run of ticks.splice(0)) run()
  await wait()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /look live/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /· look$/ })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /· other$/ })).toBeTruthy()
  await ui.unmount()
})

test('register: compose records the output style and leaves the result unchanged', async ($, on) => {
  const sections = [{ id: 'a', text: 'x', scope: 'shared' }] as never
  deskStub(on, { s: json() }, [])
  on('prompt.compose', () => ({ sections }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await wait()
  const r = await $.prompt.compose({ model: 'm', promptModel: 'm', tools: [], surfaces: [], outputStyle: { name: 'Explanatory', isKeepingCodingInstructions: true }, traits: [] })
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
