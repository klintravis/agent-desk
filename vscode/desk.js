// Everything of the extension that is not VS Code glue: `npm test` loads this without VS Code.
// The desk's own CLI decides; this runs it and reads what it prints.
const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const STATUS_VERSION = 2;
const kit = (desk) => join(desk, 'node_modules', 'agent-desk');

// The first root: the generated .code-workspace lists the desk first, and VS Code needs it as a root anyway.
const findDesk = (folders) => folders.find((f) => existsSync(join(f, 'desk.config.json'))) ?? null;

// No shell: a ruling is the owner's text and must stay one argv element.
function run(desk, args) {
  const bin = join(kit(desk), 'bin', 'desk.mjs');
  if (!existsSync(bin)) return Promise.reject(new Error(`${bin} is missing: run npm install in the desk folder.`));
  // `desk` reads this id as the author: a press here is the owner's, even in a VS Code started from a Claude session.
  const { CLAUDE_CODE_SESSION_ID, ...env } = process.env;
  const options = { cwd: desk, env: { ...env, DESK_HOME: desk }, timeout: 45e3, maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'utf8' };
  return new Promise((resolve, reject) => execFile('node', [bin, ...args], options, (err, stdout, stderr) => {
    if (!err) return resolve(stdout);
    reject(new Error(err.code === 'ENOENT' ? 'node is not on PATH: the desk CLI needs Node 20 or newer.' : (stderr || err.message).trim()));
  }));
}

function parseStatus(stdout) {
  const s = JSON.parse(stdout);
  if (s.v !== STATUS_VERSION) throw new Error(`The desk's agent-desk prints status v${s.v}, this extension reads v${STATUS_VERSION}: update whichever is older.`);
  if (s.branches?.some((b) => !b.state)) throw new Error('The desk\'s agent-desk prints branches without a state, this extension needs it: update whichever is older.');
  if (!s.todos) throw new Error('The desk\'s agent-desk prints status without todos, this extension needs it: update whichever is older.');
  return s;
}

const lines = (...parts) => parts.filter(Boolean).join('\n');
const icon = (id, color) => ({ id, color });
const section = (key, title, children, open = true, ic) => ({ id: key, label: `${title} (${children.length})`, children, open, icon: ic });

// The colour of the state word `desk status --json` computes per branch (branchWord in bin/desk.mjs); nothing is decided here.
const COLOUR = { 'CI failed': 'red', 'fixes needed': 'red', ready: 'green', 'CI running': 'yellow', 'needs review': 'yellow', rebase: 'yellow' };
const branchState = (b) => COLOUR[b.state] ?? 'blue';
const STATE = { red: icon('error', 'charts.red'), green: icon('pass', 'charts.green'), yellow: icon('sync', 'charts.yellow'), blue: icon('circle-large-filled', 'charts.blue') };

// Most urgent first, as the pane orders its branches; 3 is in progress, 4 a claim with no branch.
const RANK = { 'CI failed': 0, 'fixes needed': 0, rebase: 1, 'needs review': 1, ready: 2 };
// The pane's rule (prColor in hooks/pane.tsx) for a pull request's review.
const prColour = (p) => (p.decision === 'CHANGES_REQUESTED' ? 'red' : p.decision === 'APPROVED' && !p.unresolved && !p.sinceHead ? 'green' : 'orange');
const PR = { red: icon('error', 'charts.red'), green: icon('pass', 'charts.green'), orange: icon('circle-large-filled', 'charts.orange') };

const todoTip =(t) => [`${t.id} ${t.title}`, t.state && `state: ${t.state}`, t.next && `next: ${t.next}`];

// One row per branch or claim, with the active todos on that slug. Any other active todo is in `s.todos`.
function workRows(s) {
  const by = new Map();
  const row = (key) => by.get(key) ?? by.set(key, { key, todos: [] }).get(key);
  for (const b of s.branches) row(b.slug).branch = b;
  for (const c of s.claims) row(c.slug).claim = c;
  for (const t of s.active) by.get(t.slug)?.todos.push(t);
  const rank = ({ branch: b }) => (b ? RANK[b.state] ?? 3 : 4);
  const carded = new Set((s.prs ?? []).map((p) => p.slug)); // the Pull requests section says an open PR, once
  return [...by.values()].sort((x, y) => rank(x) - rank(y)).map(({ key, todos, branch: b, claim: c }) => {
    const one = todos.length === 1 ? todos[0] : null;
    const detail = b
      ? [b.state, b.behind && `behind ${b.behind.base} by ${b.behind.n}`, b.pr && !(carded.has(key) && b.pr.state === 'OPEN') && `PR #${b.pr.number} ${b.pr.state}`].filter(Boolean).join(' · ')
      : 'claimed';
    return {
      id: `work:${key}`, label: one ? one.summary || one.title || key : key, icon: STATE[b ? branchState(b) : 'blue'],
      description: todos.length > 1 ? [`${todos.length} todos`, detail].filter(Boolean).join(' · ') : detail,
      tooltip: lines(...(one ? todoTip(one) : []), b && `branch ${key} @${b.head.slice(0, 7)}: ${b.ci}; verdict: ${b.verdict ?? 'none'}`, c && `held by ${c.from}`),
      children: todos.length > 1 ? todos.map((t) => ({ id: `todo:${t.id}`, label: t.summary || t.title || t.id, description: t.id, tooltip: lines(...todoTip(t)) })) : [],
    };
  });
}

const TODO = { active: icon('circle-large-filled', 'charts.blue'), blocked: icon('circle-slash', 'charts.orange'), open: icon('circle-large-outline') };

// The status as plain tree rows, one list per view. VS Code draws strings as text, so desk text cannot inject anything.
function statusTree(s) {
  const decisions = s.decisions.map((d) => ({
    id: `decision:${d.id}`, label: `${d.id} ${d.title}`, tooltip: 'Press to walk the waiting decisions', decide: true, open: true, icon: icon('question', 'charts.orange'),
    children: (d.options ?? []).map((o, i) => ({ id: `option:${d.id}:${i}`, label: o.label, description: [!i && 'Recommended', o.why].filter(Boolean).join(' · '), tooltip: o.why })),
  }));
  // The pane's order: branches and claims, Pull requests, Overlaps, Running sessions (its Agents card is the engine's, not in the status).
  const work = [
    ...workRows(s),
    section('prs', 'Pull requests', (s.prs ?? []).map((p) => ({
      id: `pr:${p.slug}`, label: `${p.slug} #${p.number}`, icon: PR[prColour(p)],
      description: `review ${p.decision.toLowerCase().replace(/_/g, ' ')} · ${p.comments} comment(s) · ${p.unresolved} unresolved · ${p.sinceHead} new since the head commit${s.branches.find((b) => b.slug === p.slug)?.pr?.state === 'OPEN' ? ' · a person merges' : ''}`,
    })), true),
    s.overlaps === null ? { id: 'overlaps', label: 'Overlaps (unavailable)', children: [], tooltip: 'The overlap check failed' }
      : section('overlaps', 'Overlaps', (s.overlaps ?? []).map((text, i) => ({ id: `overlap:${i}`, label: text })), false, icon('warning', 'editorWarning.foreground')),
    // Slugs stay out of a session row: its branch or claim row shows them.
    s.sessions === null ? { id: 'sessions', label: 'Running sessions (unavailable)', children: [], tooltip: 'The session transcripts could not be read' }
      : section('sessions', 'Running sessions', (s.sessions ?? []).map((x) => ({
        id: `session:${x.session}`, label: x.title || x.session, icon: icon('broadcast', 'charts.blue'),
        description: x.agents.length ? `${x.agents.length} agent${x.agents.length > 1 ? 's' : ''}` : undefined,
        tooltip: lines(x.title ? `${x.title} (${x.session})` : x.session),
        children: x.agents.map((a, i) => ({ id: `agent:${x.session}:${i}`, label: a.type, description: a.about || undefined })),
      })), true),
  ].filter((n) => n.id.startsWith('work:') || n.children.length || s.sessions === null && n.id === 'sessions' || s.overlaps === null && n.id === 'overlaps');
  const todos = s.todos.map((t) => ({
    id: `todo:${t.id}`, label: t.summary || t.title || t.id, icon: TODO[t.status] ?? TODO.open, tooltip: lines(...todoTip(t)),
    // The pane's label (status, then wt:<slug>, else owner, else area) after the id.
    description: [t.id, t.status !== 'open' && t.status, t.slug ? `wt:${t.slug}` : t.owner ?? t.area].filter(Boolean).join(' · '),
  }));
  const orEmpty = (rows, label) => (rows.length ? rows : [{ id: 'empty', label, icon: icon('check', 'charts.green') }]);
  return { decisions: orEmpty(decisions, 'No decisions waiting'), work: orEmpty(work, 'Nothing in progress'), todos: orEmpty(todos, 'No open todos') };
}

// The first waiting decision, or null: the same `desk decide --json` hooks/pane.tsx reads.
const nextDecision = async (desk) => JSON.parse(await run(desk, ['decide', '--json']));

// A row's label is what a choice records, so the marker sits in its description. `other` opens the input box for a free-text ruling.
const decisionPicks = (d) => [
  ...d.options.map((o, i) => ({ label: o.label, description: i ? undefined : 'Recommended', detail: o.why })),
  { label: 'Other…', other: true },
];

// decisions.jsonl is committed. The check comes from the desk's kit; if it cannot load, the import throws and nothing is recorded.
async function record(desk, id, ruling) {
  const { hasSecret } = await import(pathToFileURL(join(kit(desk), 'hooks', 'secretpatterns.mjs')).href);
  if (hasSecret(ruling)) throw new Error('That ruling looks like it holds a secret, and decisions.jsonl is committed: nothing recorded.');
  return run(desk, ['decide', id, ruling]);
}

module.exports = { findDesk, run, parseStatus, statusTree, nextDecision, decisionPicks, record };
