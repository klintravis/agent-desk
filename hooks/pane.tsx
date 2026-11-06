import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, On } from 'claude-code'

import type { AgentRow, DeskMeters, DeskStatus, WarmState } from '../types'
import { bar, cacheLine, ctxLine, CTX_HINT, line, paint, tok } from './meters'
import { prText } from './prtext.mjs'
import { durationOf, quotaLine } from './quota'
import { scrub } from './redact'

// The desk pane: session rows, then `desk status` (--json), refreshed every minute and when a local file changes, beside the chat in
// interactive sessions, or once a surface attaches. The band above the prompt counts the owner decisions in that same status and
// warns near a full context (any session); /decide and the Decide Button run `desk decide`.
// The CLI is this plugin's own bin/desk.mjs; it finds the desk by DESK_HOME (desk sync sets it in each
// checkout's settings) or by walking up from the session's folder to desk.config.json.
const PANE = 'desk-status'
const EVERY = 60_000 // status calls gh; once a minute is plenty
export const LOOK_EVERY = 2_000 // three stats; a change runs `status --cached`, which does not call gh
// A declaration, not an arrow: the engine follows $ across a call only into a function declaration.
function desk($: Engine) { return `${$.plugin.root}/bin/desk.mjs` }
let home = ''
// `desk home` exits 0 only inside a desk (DESK_HOME, or desk.config.json at or above the session's folder).
export async function inDesk($: Engine) {
  return $.process.run(['node', desk($), 'home'], { timeoutMs: 15_000 }).then((p) => { home = p.stdout.trim(); return p.exitCode === 0 }, () => false)
}
const status = atom({ plugin: 'agent-desk', key: 'status' } as const, null, { shape: 'status-4' })
const err = atom({ plugin: 'agent-desk', key: 'err' } as const, '', { shape: 'err-1' })
// The session's meters as numbers: every surface formats them (status line, band, pane).
const meters = atom({ plugin: 'agent-desk', key: 'meters' } as const, {}, { shape: 'meters-2' })
// Session state, never $.store: keep-warm off must not outlive the session. Only the Warm Button writes `off`.
const warm = atom({ plugin: 'agent-desk', key: 'warm' } as const, { off: false }, { shape: 'warm-1' })
const style = atom({ plugin: 'agent-desk', key: 'style' } as const, null, { shape: 'style-1' })
const agents = atom({ plugin: 'agent-desk', key: 'agents' } as const, [], { shape: 'agents-1' })
const tab = atom({ plugin: 'agent-desk', key: 'tab' } as const, 'work', { shape: 'tab-2' })
const TODOS = 10
export async function showMeters($: Engine, m: DeskMeters) {
  await update($, meters, () => m)
}
// The engine's state scan reads atoms only from the file that declares them, so register.ts goes through these.
export async function warmOff($: Engine) { return (await read($, warm)).off }
export async function setWhy($: Engine, why: string | undefined) { await update($, warm, (w) => (w.why === why ? w : { ...w, why })) }
export async function recordStyle($: Engine, name: string | null) { if (name !== (await read($, style))) await update($, style, () => name) }
// Live agents with the time the minute tick first saw each; returns the count.
export async function trackAgents($: Engine, live: readonly { id: string; type: string; description: string; status: string }[], now: number) {
  const prev = new Map((await read($, agents)).map((a) => [a.id, a.since]))
  await update($, agents, () => live.map((a) => ({ id: a.id, type: a.type, description: a.description, status: a.status, since: prev.get(a.id) ?? now })))
  return live.length
}

// Size and mtime: on NTFS the mtime alone missed back-to-back appends. A missing file or a refused path stays one value: the minute run still comes.
async function localStamp($: Engine) {
  let stamp = ''
  if (home) for (const f of ['todo.jsonl', 'board.jsonl', 'decisions.jsonl']) stamp += await $.fs.stat(`${home}/${f}`).then((s) => `${s.size}:${s.mtimeMs},`, () => '-,')
  return stamp
}

// One run at a time, so a slow gh cannot stack runs up. `again`: null none asked; else whether all that were asked can use gh's last answers.
let busy = false, again: boolean | null = null, stamped = ''
async function refresh($: Engine, cached = false) {
  if (busy) { again = (again ?? true) && cached; return }
  busy = true
  try {
    stamped = await localStamp($) // before the run: a write during it is seen by the next look
    const p = await $.process.run(['node', desk($), 'status', ...(cached ? ['--cached'] : []), '--json'], { timeoutMs: 45_000 }).catch((e) => ({ stdout: '', stderr: `desk status failed: ${e}` }))
    let s: DeskStatus | undefined, bad = ''
    try { s = JSON.parse(p.stdout) } catch (e) { bad = p.stderr || `desk status failed: ${e}` }
    if (s) {
      await update($, status, () => s)
      line.flag = s.decisions.length
      paint($)
    }
    await update($, err, () => bad)
  } finally {
    busy = false
    if (again !== null) { const next = again; again = null; void refresh($, next).catch(() => {}) }
  }
}

async function look($: Engine) {
  if (home && !busy && (await localStamp($)) !== stamped) await refresh($, true)
}

// Called from register's session.start hook (interactive) or, once a surface attaches, its session.attach hook.
// Idempotent: session.start (interactive) and session.attach (SDK hosts: VS Code, desktop) may both call it.
let started = false
export async function startPane($: Engine, isInteractive: boolean | undefined) {
  if (!isInteractive || started) return
  started = true
  await $.command.register({ name: 'desk', description: 'Open the desk status pane (desk status)' }).catch(() => {})
  await $.command.register({ name: 'decide', description: 'Owner decisions one at a time; /decide T-n <ruling> records one; /decide --list [n] lists rulings', argumentHint: '[T-n <ruling> | T-n --pick <n> | --list [n]]' }).catch(() => {})
  $.clock.every(EVERY, () => void refresh($).catch(() => {}))
  $.clock.every(LOOK_EVERY, () => void look($).catch(() => {})) // a reload of the plugin cancels both timers
  void refresh($).catch(() => {})
  void $.ui.open({ id: PANE, title: 'Desk' }).catch(() => {})
}

// `/decide` and a press both come here: $.command.run skips the calling plugin's own hook, so a press cannot go through it.
async function runDecide($: Engine, argv: string[]) {
  const r = await $.process.run(['node', desk($), 'decide', ...argv], { timeoutMs: 30_000 })
    .then((p) => ({ ok: p.exitCode === 0, text: (p.stdout || p.stderr).trim() }), (err) => ({ ok: false, text: `desk decide failed: ${err}` }))
  if (/^T-\d+$/.test(argv[0] ?? '')) void refresh($, true).catch(() => {}) // the band drops the decision now, not at the next minute
  return r
}

// A typed line: the ruling is one argument, and text starting with the flag splits so the CLI reads it and refuses a bad value. A clicked label never comes here.
const typedArgs = (args: string) => {
  const m = /^(T-\d+)\s+([\s\S]+)$/.exec(args)
  if (!m) return args.split(/\s+/).filter(Boolean)
  // m[1] and m[2] are mandatory groups of the regex.
  return /^--pick(\s|$)/.test(m[2]!) ? [m[1]!, ...m[2]!.split(/\s+/)] : [m[1]!, m[2]!]
}

// `desk decide --json`: the first waiting decision, or null.
type Decision = { id: string; title: string; context: string | null; options: { label: string; why?: string }[] }

// $.ui.ask takes labels only, so each option's why sits in this text. The marker sits here too: on a label it would be recorded with the ruling.
const decisionLines = (d: Decision) => [
  `${d.id}: ${d.title}`,
  ...(d.context ? [d.context] : []),
  ...d.options.map((o, i) => `${i ? 'Or' : 'Recommended'}: ${o.label}${o.why ? ` - ${o.why}` : ''}`),
].join('\n')

// A Decide press walks the waiting decisions in the engine's dialog and records each answer: a picked label as it is, text typed under Other after redaction, on one line, cut to 1000 characters. The id is the one
// `desk decide --json` gave: the cached status's can be a minute old, and a ruling must land on the question the owner read.
// The dialog takes 2-4 options and pads fewer with Yes/No, which would record `Yes`: the others get the toast and `/decide T-n `.
// shortcut: a dialog the engine never settles keeps the guard set until the mod reloads; add a timeout if a live press shows that.
let walking = false
// quiet: a typed /decide, where the owner closing the dialog is an answer of its own and not worth a toast.
async function ask($: Engine, quiet = false) {
  if (walking) return
  walking = true
  try {
    for (;;) {
      const r = await runDecide($, ['--json'])
      if (!r.ok || !r.text) { if (r.text) $.ui.toast(r.text, { timeoutMs: 30_000 }); return }
      const d = JSON.parse(r.text) as Decision | null
      if (!d) { $.ui.toast('No owner decisions waiting.', { timeoutMs: 30_000 }); return }
      if (d.options.length < 2 || d.options.length > 4) {
        $.ui.toast(`${decisionLines(d)}\nAnswer: /decide ${d.id} <ruling>`, { timeoutMs: 30_000 })
        await $.prompt.read().then((p) => (p.text.trim() ? undefined : $.prompt.fill({ text: `/decide ${d.id} ` }))).catch(() => {})
        return
      }
      // AskOptions has labels only, no per-option description, so the whys stay in the question text.
      const answer = await $.ui.ask(`${decisionLines(d)}\nYour ruling?`, { options: d.options.map((o) => o.label), header: 'Decision' })
        .catch((e) => { if (quiet) return undefined; throw e })
      if (answer === undefined) return
      // scrub: typed text passes no redaction hook on the way to decisions.jsonl. A picked label is recorded as it is, and the CLI refuses a secret in it.
      const picked = d.options.some((o) => o.label === answer)
      const ruling = picked ? answer : scrub(answer)
      const done = await runDecide($, [d.id, ruling])
      if (!done.ok) { $.ui.toast(done.text, { timeoutMs: 30_000 }); return }
      // Only once recorded; the toast names neither the typed text nor what was masked.
      if (ruling !== answer) $.ui.toast('Your answer held a secret or personal detail: it was masked in the record.', { timeoutMs: 30_000 })
    }
  } catch (e) {
    $.ui.toast((e as Error)?.message ?? String(e), { timeoutMs: 30_000 })
  } finally {
    walking = false
  }
}
const ago = (now: number, ts: number | string) => durationOf(Math.max(0, now - (typeof ts === 'string' ? Date.parse(ts) : ts)))
const ctxColor = (pct: number) => (pct >= CTX_HINT ? 'red' : pct >= 60 ? 'orange' : 'green')
// What a row names, so a scan finds it; a theme key, so it reads on light and dark. Status keeps red, orange and green.
const ACCENT = 'suggestion'
export const quotaColor = (q: NonNullable<DeskMeters['quota']>) => ctxColor(Math.max(0, ...q.rows.map((r) => r.pct)))
export const prColor = (p: NonNullable<DeskStatus['prs']>[number]) =>
  p.decision === 'CHANGES_REQUESTED' ? 'red' : p.decision === 'APPROVED' && !p.unresolved && !p.sinceHead ? 'green' : 'orange'
// A card's border: the worst status inside it, undefined when there is none.
export const worst = (colors: readonly (string | undefined)[]) => (['red', 'orange', 'green'] as const).find((c) => colors.includes(c))
type Branch = DeskStatus['branches'][number]
// Where a branch stands is computed once, by `desk status --json` (branchWord in bin/desk.mjs, the rule `wt merge` uses); this only
// gives the word a colour and a rank. rank: 0 and 1 need action, 2 is ready, 3 is in progress.
const LOOK: Record<string, { color: string; rank: number }> = {
  'CI failed': { color: 'red', rank: 0 }, 'fixes needed': { color: 'red', rank: 0 }, rebase: { color: 'orange', rank: 1 },
  'needs review': { color: 'orange', rank: 1 }, 'not pushed': { color: 'orange', rank: 1 }, ready: { color: 'green', rank: 2 },
}
export function branchState(b: Branch): { word: string; color: string; rank: number } {
  const word = b.state || 'CI unknown' // an older desk CLI sends no state
  return { word, ...(LOOK[word] ?? { color: 'orange', rank: 3 }) }
}
// The dim second line of a branch row, empty when the state word says it all.
// carded: the Pull requests card lists this branch, so an open PR is said there, once.
export function branchNote(b: Branch, carded = false) {
  const word = branchState(b).word
  return [b.pr && !(carded && b.pr.state === 'OPEN') && prText(b.slug, b.pr), // first: the row truncates at its end
    b.behind && `behind ${b.behind.base} by ${b.behind.n}`,
    b.verdict && word !== 'ready' && word !== 'fixes needed' && `verdict ${b.verdict.replace(/@([0-9a-f]{7})[0-9a-f]+/, '@$1')}${b.verdictOld ? ', older commit' : ''}`,
    (word === 'CI stale' || word === 'CI unknown') && b.ci].filter(Boolean).join(' · ')
}
export const branchColor = (b: Branch) => branchState(b).color
// The count line above the tabs; null when nothing is ready or waits on someone. In-progress branches are not counted.
export function headline(branches: readonly Branch[]) {
  const states = branches.map(branchState).filter((x) => x.rank < 3)
  const n = (word: string) => states.filter((x) => x.word === word).length
  const parts = [[n('ready'), 'ready to merge'], [n('needs review'), n('needs review') === 1 ? 'needs review' : 'need review'], [n('not pushed'), 'not pushed'], [n('rebase'), 'to rebase'], [n('fixes needed'), 'fixes needed'], [n('CI failed'), 'CI failed']] as const
  return states.length ? { text: parts.filter(([c]) => c).map(([c, w]) => `${c} ${w}`).join(' · '), color: worst(states.map((x) => x.color))! } : null
}
// `a + b: file, file (+1)` lines as files, most-contended first.
// shortcut: files hidden behind `(+n)` are not counted, carry structured overlaps in the status JSON if a count looks wrong.
export function overlapRows(lines: readonly string[]) {
  const slugs = new Map<string, Set<string>>()
  for (const l of lines) {
    const m = /^(.+?) \+ (.+?): (.*)$/.exec(l)
    if (!m) continue
    for (const f of m[3]!.replace(/\s\(\+\d+\)$/, '').split(', ')) slugs.set(f, (slugs.get(f) ?? new Set()).add(m[1]!).add(m[2]!))
  }
  return [...slugs].map(([file, s]) => ({ file, n: s.size })).sort((a, b) => b.n - a.n || a.file.localeCompare(b.file))
}

export function registerPane(on: On) {
  on('command.run', { command: 'desk' }, async ($) => {
    await $.ui.open({ id: PANE, title: 'Desk' })
    return { text: 'Desk pane opened.' }
  })

  // `/decide` walks the waiting decisions in the dialog, as the Decide Button does; `/decide T-n <ruling>` records one (the ruling is one argv element), `/decide T-n --pick <n>` picks one.
  // $.ui.ask rejects alike when dismissed and in a -p run, so "a dialog is possible" is asked of $.session.surfaces() (empty in -p): none, or
  // a failing call, gets the old text. The walk is not awaited: the turn waits on this hook, and the dialog waits on the owner.
  // Only a decision the dialog can take opens it; none waiting, or 1 or 5+ options, stay on screen as text. A rule denying the
  // dialog also reads as a dismissal, so the line names the way out.
  on('command.run', { command: 'decide' }, async ($, e) => {
    const args = (e.args ?? '').trim()
    if (!args && (await $.session.surfaces().catch(() => [])).length) {
      const next = await runDecide($, ['--json'])
      let n = 0
      try { n = (JSON.parse(next.text) as Decision | null)?.options.length ?? 0 } catch { /* an older CLI's refusal: the text below */ }
      if (next.ok && n >= 2 && n <= 4) {
        void ask($, true).catch(() => {})
        return { text: 'Decisions: answer in the dialog. If none opens, use /decide T-n <ruling> or desk decide.' }
      }
    }
    return { text: (await runDecide($, typedArgs(args))).text }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const n = (await read($, status))?.decisions?.length ?? 0
    const ctx = (await read($, meters)).ctx
    const near = !!ctx && ctx.pct >= CTX_HINT
    if (e.props.hasSurvey || (!n && !near)) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {n > 0 && (
          <Box>
            <Text color="yellow" bold>⚑ {n} decision{n === 1 ? '' : 's'} waiting </Text>
            <Button key="decide" variant="primary" onPress={() => void ask($).catch(() => {})}>{`Decide (${n})`}</Button>
          </Box>
        )}
        {near && <Text color="red">ctx {bar(ctx.pct, 8)} {ctx.pct}%  near full: handoff or /compact</Text>}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const s = await read($, status)
    const bad = await read($, err)
    const m = await read($, meters)
    const w: WarmState = await read($, warm)
    const style_ = await read($, style)
    const ag: AgentRow[] = await read($, agents)
    const now = await $.clock.now()
    const cols = e.props.bodyColumns
    const open = await read($, tab)
    const me = await $.session.id().catch(() => '')
    // mono: the padded labels only line up in a fixed-width face, and an editor's pane is not one by default.
    const row = (label: string, ...kids: unknown[]) => <Box key={label}><Text dimColor mono>{label.padEnd(8)}</Text>{kids as never}</Box>
    const card = { flexDirection: 'column', paddingX: 1, borderStyle: 'round' } as const
    const section = (title: string, kids: unknown, borderColor?: string) => <Box key={title} {...card} marginTop={1} {...(borderColor ? { borderColor } : { borderDimColor: true })}><Text size="heading" weight="semibold">{title}</Text>{kids as never}</Box>
    // The id row of a todo: id + summary (the title when unset) and one optional label.
    // The head is what gets cut; the label keeps its width unless it alone is wider than the pane
    // (the card's border and padding take 4 columns, the gap 1).
    const oneRow = (x: DeskStatus['active'][number], label = '') => {
      const about = typeof x.summary === 'string' && x.summary ? x.summary : x.title
      return (
        <Box gap={1}>
          <Box flexShrink={1}><Text weight="medium" wrap="truncate-end"><Text color={ACCENT}>{x.id}</Text> {about}</Text></Box>
          {label ? <Box flexShrink={label.length + 5 <= cols ? 0 : 1}><Text {...(x.slug ? { color: ACCENT } : { dimColor: true })} size="footnote" wrap="truncate-end">{label}</Text></Box> : null}
        </Box>
      )
    }
    const none = (what = 'none') => <Text dimColor>{what}</Text>
    const count = (n: number) => (n < 1e3 ? String(n) : tok(n)) // tok rounds 350 to 0k
    // The dot lets a status be found at a glance; the words stay so color is never the only signal.
    const status_ = (color: string, text: string) => <Box gap={1}><Text color={color}>●</Text><Text color={color}>{text}</Text></Box>
    const head = s && headline(s.branches)
    const holder = (slug: string) => { const c = s?.claims.find((x) => x.slug === slug); return c && (s?.sessions?.find((x) => x.session === c.from)?.title || c.from) }
    const loose = s?.claims.filter((c) => !s.branches.some((b) => b.slug === c.slug)) ?? []
    const contended = overlapRows(s?.overlaps ?? [])
    // Pressing writes the toggle, then repaints the status line's warm slot; a press is not a render.
    const flip = () => void update($, warm, (x) => ({ ...x, off: !x.off })).then(async () => { line.off = await warmOff($); paint($) }).catch(() => {})
    const why = w.off ? 'off for this session' : w.why?.replace(/^warm-hold: /, '') || 'idle'
    const branchBorder = worst((s?.branches ?? []).map(branchColor)), prBorder = worst((s?.prs ?? []).map(prColor)), overlapBorder = s?.overlaps?.length ? 'orange' : undefined
    // A closed tab hides its cards, so its worst news marks the tab; orange would be lit by any branch in progress.
    const branchRed = branchBorder === 'red' || prBorder === 'red'
    const tabs = s ? [['decisions', `Decisions ${s.decisions.length}`, s.decisions.length ? 'yellow' : undefined], ['work', `Work ${s.branches.length + loose.length}`, branchRed ? 'red' : undefined], ['todos', `Todos ${s.todos?.length ?? '?'}`, undefined]] : []
    // The active todos of one branch or claim, under its row: the row already names the slug.
    const todoRow = (x: DeskStatus['active'][number], label?: string) => (
      <Box key={x.id} flexDirection="column">
        {oneRow(x, label)}
        {x.state ? <Text dimColor size="footnote" wrap="truncate-end">state: {String(x.state)}</Text> : null}
        {x.next ? <Text size="footnote" wrap="truncate-end">next: {String(x.next)}</Text> : null}
      </Box>
    )
    const todosOn = (slug: string) => s?.active.filter((x) => x.slug === slug).map((x) => todoRow(x))
    return (
      <Box flexDirection="column">
        <Box {...card} borderDimColor>
          {m.ctx && row('Context', <Text tabular color={ctxColor(m.ctx.pct)}>{ctxLine(m.ctx)}</Text>)}
          {m.quota && row('Quota', <Text tabular color={quotaColor(m.quota)}>{quotaLine(m.quota)}</Text>)}
          {m.cache !== undefined
            ? row('Cache', <Text tabular>{cacheLine(m.cache)}</Text>, <Text dimColor> · style </Text>, <Text wrap="truncate-end">{style_ ?? 'default'}</Text>)
            : row('Style', <Text wrap="truncate-end">{style_ ?? 'default'}</Text>)}
          {row('Warm', <Button key="warm" onPress={flip}>{w.off ? 'off' : 'auto'}</Button>, <Text {...(w.off ? { color: 'orange' } : { dimColor: true })}> {why}</Text>)}
          {s && row('Tokens', s.tokens ? <Text tabular wrap="truncate-end">{s.tokens.calls} calls · fresh {count(s.tokens.fresh)} · cached {count(s.tokens.cached)} · out {count(s.tokens.out)}</Text> : none('unavailable'))}
          {s && row('Roots', s.roots.length ? <Box flexDirection="column" flexShrink={1}>{s.roots.map((r) => <Text key={r.id} dimColor wrap="truncate-end">{r.id} · {r.merge ? `${r.merge} · ` : ''}{r.kind === 'folder' ? 'folder' : `${r.defaultBranch} @${r.sha?.slice(0, 7) || '?'} · ${r.gh ? `CI ${r.gh}` : 'no CI'}`} · {r.path}</Text>)}</Box> : none())}
        </Box>
        {!s && <Text dimColor>{bad || 'Loading desk status…'}</Text>}
        {s && bad && <Text color="red">{bad}</Text>}
        {s?.warnings?.map((w, i) => <Text key={String(i)} color="orange">Warning: {w}</Text>)}
        {head && <Box marginTop={1} paddingX={1}><Text color={head.color} weight="medium" wrap="truncate-end">{head.text}</Text></Box>}
        {s && <Box marginTop={1} gap={1}>{tabs.flatMap(([id, label, mark]) => [<Button key={`tab-${id}`} {...(open === id ? { variant: 'primary' as const } : { dimColor: true })} onPress={() => void update($, tab, () => id!).catch(() => {})}>{label}</Button>, ...(mark ? [<Text key={`mark-${id}`} color={mark}>●</Text>] : [])])}</Box>}
        {s && open === 'decisions' && section('Decisions', s.decisions.length ? <Box flexDirection="column" gap={1}>{s.decisions.map((d) => (
          <Box key={d.id} flexDirection="column">
            <Text color="yellow">{d.id} {d.title}</Text>
            {(d.options ?? []).map((o, i) => <Text key={String(i)} size="footnote">{i ? 'Or' : 'Recommended'}: {o.label}{o.why ? <Text dimColor> · {o.why}</Text> : null}</Text>)}
          </Box>
        ))}<Box><Button key="decide" variant="primary" onPress={() => void ask($).catch(() => {})}>{`Decide (${s.decisions.length})`}</Button></Box></Box> : none('No decisions waiting'), s.decisions.length ? 'yellow' : undefined)}
        {s && open === 'work' && section('Open branches', s.branches.length + loose.length ? <Box flexDirection="column" gap={1}>{[...[...s.branches].sort((a, b) => branchState(a).rank - branchState(b).rank).map((b) => {
          const st = branchState(b), who = holder(b.slug), note = branchNote(b, !!s.prs?.some((p) => p.slug === b.slug))
          return (
            <Box key={b.slug} flexDirection="column">
              <Box justifyContent="space-between" gap={1}>
                <Box flexShrink={1}><Text wrap="truncate-end"><Text weight="medium" color={ACCENT}>{b.slug}</Text> <Text color={st.color}>● {st.word}</Text>{who ? <Text dimColor> · {who}</Text> : null}</Text></Box>
                <Box flexShrink={0}><Text dimColor mono>@{b.head.slice(0, 7)}</Text></Box>
              </Box>
              {note ? <Text dimColor size="footnote" wrap="truncate-end">{note}</Text> : null}
              {todosOn(b.slug)}
            </Box>
          )
        }), ...loose.map((c) => (
          <Box key={c.slug} flexDirection="column">
            <Text wrap="truncate-end"><Text color={ACCENT}>{c.slug}</Text> · {c.from} · claimed {ago(now, c.ts)}{c.last ? ` · last post ${ago(now, c.last)}` : ''}</Text>
            {todosOn(c.slug)}
          </Box>
        ))]}</Box> : none(), branchBorder)}
        {s && open === 'work' && ag.length > 0 && section('Agents', ag.map((a) => <Text key={a.id}><Text color={ACCENT}>{a.type}</Text> · {a.description} · {ago(now, a.since)}</Text>))}
        {s && open === 'work' && s.prs && section('Pull requests', s.prs.length ? s.prs.map((p) => <Box key={p.slug}>{status_(prColor(p), `${p.slug} #${p.number} · review ${p.decision.toLowerCase().replace(/_/g, ' ')} · ${p.comments} comment(s) · ${p.unresolved} unresolved · ${p.sinceHead} new since the head commit${s.branches.find((b) => b.slug === p.slug)?.pr?.state === 'OPEN' ? ' · a person merges' : ''}`)}</Box>) : none(), prBorder)}
        {s && open === 'work' && section('Overlaps (second to merge rebases)', s.overlaps === null ? none('unavailable') : contended.length ? [
          ...contended.slice(0, 3).map((o) => <Text key={o.file} color="orange" wrap="truncate-end">{o.file} · {o.n} branches</Text>),
          ...(contended.length > 3 ? [<Text key="more" dimColor>+{contended.length - 3} more</Text>] : []),
        ] : none(), overlapBorder)}
        {s && open === 'work' && section('Running sessions', s.sessions === null ? none('unavailable') : s.sessions.length ? <Box flexDirection="column" gap={1}>{s.sessions.map((x) => {
          // This session's agents, when the engine lists them, are in the Agents card above: not twice.
          const agents = ag.length && me.startsWith(x.session) ? [] : x.agents, n = agents.length
          const foot = [x.title && x.session, n &&`${n} agent${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
          return (
            <Box key={x.session} flexDirection="column">
              <Box gap={1}>
                <Box flexShrink={1}><Text weight="medium" wrap="truncate-end"><Text color={ACCENT}>●</Text> {x.title || x.session}</Text></Box>
                {me.startsWith(x.session) ? <Box flexShrink={0}><Text color={ACCENT} size="footnote">this session</Text></Box> : null}
              </Box>
              {foot ? <Text dimColor size="footnote" wrap="truncate-end">{foot}</Text> : null}
              {agents.map((a, i) => <Box key={String(i)} paddingLeft={2}><Text wrap="truncate-end"><Text color={ACCENT}>{a.type}</Text>{a.about ? ` · ${a.about}` : ''}</Text></Box>)}
            </Box>
          )
        })}</Box> : none())}
        {s && open === 'todos' && section('Todos', !s.todos ? none('unavailable') : s.todos.length ? <Box flexDirection="column" gap={1}>{[
          ...s.todos.slice(0, TODOS).map((x) => todoRow(x, [x.status !== 'open' && x.status, x.slug ? `wt:${x.slug}` : x.owner ?? x.area].filter(Boolean).join(' · '))),
          ...(s.todos.length > TODOS ? [<Text key="more" dimColor>+{s.todos.length - TODOS} more</Text>] : []),
        ]}</Box> : none('No open todos'))}
        {s && <Box marginTop={1} paddingX={1}><Text dimColor size="caption">As of {s.at.slice(0, 16).replace('T', ' ')}Z</Text></Box>}
      </Box>
    )
  })
}
