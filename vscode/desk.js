// Everything of the extension that is not VS Code glue: `npm test` loads this without VS Code.
// No desk logic lives here: the desk's own CLI decides, this runs it and reads what it prints.
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
  return s;
}

const lines = (...parts) => parts.filter(Boolean).join('\n');
const section = (key, title, children, open = true) => ({ id: key, label: `${title} (${children.length})`, children, open });

// The status as plain tree rows. VS Code draws strings as text, so desk text cannot inject anything.
function statusTree(s) {
  return [
    section('decisions', 'Owner decisions', s.decisions.map((d) => ({ id: `decision:${d.id}`, label: `${d.id} ${d.title}`, tooltip: 'Press to walk the waiting decisions', decide: true }))),
    section('active', 'Active todos', s.active.map((t) => ({
      id: `active:${t.id}`, label: `${t.id} ${t.title}`, description: t.state ?? t.status,
      tooltip: lines(t.title, t.state && `state: ${t.state}`, t.next && `next: ${t.next}`),
    }))),
    section('branches', 'Branches', s.branches.map((b) => ({
      id: `branch:${b.slug}`, label: b.slug,
      description: [b.head.slice(0, 7), b.ci, `verdict: ${b.verdict ?? 'none'}`, b.behind && `behind ${b.behind.base} by ${b.behind.n}`, b.pr && `PR #${b.pr.number} ${b.pr.state}`].filter(Boolean).join(' · '),
    }))),
    section('claims', 'Claims', s.claims.map((c) => ({ id: `claim:${c.slug}`, label: c.slug, description: c.from })), false),
    section('overlaps', 'Overlaps', (s.overlaps ?? []).map((text, i) => ({ id: `overlap:${i}`, label: text })), false),
  ];
}

// Same parse as printedDecision in hooks/pane.tsx: the lines of decideText in bin/desk.mjs.
function printedDecision(text) {
  const head = /^(T-\d+) \(\d+ of \d+\): .*$/m.exec(text);
  return head && { id: head[1], head: head[0], options: [...text.matchAll(/^ {2}(?:Recommended|Or): (.*)$/gm)].map((o) => o[1]) };
}

// decisions.jsonl is committed. The check comes from the desk's kit; if it cannot load, the import throws and nothing is recorded.
async function record(desk, id, ruling) {
  const { hasSecret } = await import(pathToFileURL(join(kit(desk), 'hooks', 'secretpatterns.mjs')).href);
  if (hasSecret(ruling)) throw new Error('That ruling looks like it holds a secret, and decisions.jsonl is committed: nothing recorded.');
  return run(desk, ['decide', id, ruling]);
}

module.exports = { findDesk, run, parseStatus, statusTree, printedDecision, record };
