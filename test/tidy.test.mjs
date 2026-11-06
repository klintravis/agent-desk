// `desk tidy`: every case runs on a temp desk with HOME and USERPROFILE pointing at a temp folder, so no real
// desk, transcript or user file is read. Each delete guard is varied alone from a fixture that does get deleted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, env, BIN, git, repo } from './helpers.mjs';
import { fold } from '../bin/desk.mjs';
import { clearDead, deleteOrphans, raiseQuestion } from '../lib/tidy.mjs';

const HOUR = 3600e3, DAY = 24 * HOUR;

function fixture({ wts = true, cfg = {} } = {}) {
  const root = tmp(), home = join(root, 'desk'), fake = join(root, 'home');
  mkdirSync(home); mkdirSync(fake);
  writeFileSync(join(home, 'desk.config.json'), JSON.stringify({ worktreesDir: 'wts', repos: [{ id: 'a', path: '../a', worktreePrefix: 'a-' }], ...cfg }));
  if (wts) mkdirSync(join(home, 'wts'));
  return { root, home, fake };
}
const cli = (fx, args, envOver = {}) => spawnSync(process.execPath, [BIN, ...args], { cwd: fx.home, encoding: 'utf8', env: { ...env(fx.home), HOME: fx.fake, USERPROFILE: fx.fake, ...envOver } });
const tidy = (fx, ...args) => cli(fx, ['tidy', ...args]);
const report = (fx, ...args) => { const r = tidy(fx, '--json', ...args); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };

const line = (file, obj) => appendFileSync(file, JSON.stringify(obj) + '\n');
const todo = (fx, id, set, age = 0) => line(join(fx.home, 'todo.jsonl'), { ts: new Date(Date.now() - age).toISOString(), from: 'someone', id, set: { title: `todo ${id}`, status: 'open', area: 'a', ...set } });
const board = (fx, kind, slug, from = 'someone') => line(join(fx.home, 'board.jsonl'), { ts: new Date().toISOString(), from, kind, slug, text: '' });
const worktree = (fx, slug) => mkdirSync(join(fx.home, 'wts', `a-${slug}`, '.git'), { recursive: true });
const aged = (file, age) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, 'x'); const t = new Date(Date.now() - age); utimesSync(file, t, t); return file; };
const project = (fx, name = fx.home.replace(/[^a-zA-Z0-9]/g, '-')) => join(fx.fake, '.claude', 'projects', name);
const transcript = (fx, sid, age, proj) => aged(join(proj ?? project(fx), `${sid}-0000-0000.jsonl`), age);
const stream = (fx, slug, age = 30 * DAY) => aged(join(fx.home, 'streams', `${slug}.md`), age);
const scratch = (fx, name, age = 30 * DAY) => aged(join(fx.home, 'scratch', name), age);
const folded = (fx) => fold(readFileSync(join(fx.home, 'todo.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
const ids = (rows) => rows.map((x) => x.id);
// Every path and file content under the desk, so an mkdir shows up as well as a write.
const snapshot = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((p) => { const f = join(dir, String(p)); return [String(p), statSync(f).isDirectory() ? 'dir' : readFileSync(f, 'utf8')]; }));

// ---- report ----

test('report: lists a dead owner, an orphan and a stale todo and changes nothing', () => {
  const fx = fixture();
  transcript(fx, 'deadbeef', 25 * HOUR);
  todo(fx, 'T-1', { owner: 'deadbeef', status: 'active' });
  todo(fx, 'T-2', {}, 15 * DAY);
  stream(fx, 'old'); scratch(fx, 'old-run.jsonl'); board(fx, 'note', 'old');
  const before = snapshot(fx.home);
  const r = tidy(fx);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /T-1 deadbeef/);
  assert.match(r.stdout, /old\.md/);
  assert.match(r.stdout, /T-2 stale/);
  assert.deepEqual(snapshot(fx.home), before);
});

test('report: one line when clean, with every data file missing and no folder created', () => {
  const fx = fixture();
  const before = snapshot(fx.home);
  const r = tidy(fx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'Nothing to tidy.');
  assert.deepEqual(snapshot(fx.home), before);
});

test('report: --json has the keys, and applied is empty without --apply', () => {
  const fx = fixture();
  todo(fx, 'T-1', {}, 15 * DAY);
  const j = report(fx);
  assert.deepEqual(Object.keys(j).sort(), ['applied', 'candidates', 'dead', 'kept', 'orphans', 'strayFolders', 'unknownOwners']);
  assert.deepEqual(j.applied, []);
  assert.deepEqual(ids(j.candidates), ['T-1']);
});

test('report: an unknown flag or a positional argument is an error and writes nothing', () => {
  const fx = fixture();
  todo(fx, 'T-1', {}, 15 * DAY);
  const before = snapshot(fx.home);
  const flag = tidy(fx, '--force');
  assert.equal(flag.status, 1);
  assert.match(flag.stderr, /--force/);
  const pos = tidy(fx, 'now');
  assert.equal(pos.status, 1);
  assert.match(pos.stderr, /now/);
  assert.deepEqual(snapshot(fx.home), before);
});

// ---- dead sessions ----

test('dead owners: only an old transcript with no claim counts; missing or foreign transcripts are unknown', () => {
  const fx = fixture();
  transcript(fx, 'deadbeef', 25 * HOUR);
  transcript(fx, 'lefthour', HOUR);
  transcript(fx, 'claimedx', 30 * DAY);
  transcript(fx, 'subagent', 25 * HOUR);
  aged(join(project(fx), 'subagent-0000-0000', 'subagents', 'agent-1.jsonl'), HOUR);
  transcript(fx, 'wtsessio', 25 * HOUR, project(fx, join(fx.home, 'wts', 'a-foo').replace(/[^a-zA-Z0-9]/g, '-')));
  transcript(fx, 'foreignx', 30 * DAY, project(fx, 'C--some-other-project'));
  worktree(fx, 'live'); board(fx, 'claim', 'live', 'claimedx');
  todo(fx, 'T-1', { owner: 'deadbeef', status: 'active' });
  todo(fx, 'T-2', { owner: 'lefthour' });
  todo(fx, 'T-3', { owner: 'claimedx' });
  todo(fx, 'T-4', { owner: 'subagent' });
  todo(fx, 'T-5', { owner: 'nofileyy' });
  todo(fx, 'T-6', { owner: 'owner' });
  todo(fx, 'T-7', { owner: 'foreignx' });
  todo(fx, 'T-8', { owner: 'deadbeef', status: 'done' });
  todo(fx, 'T-9', { owner: 'wtsessio', status: 'blocked' });
  todo(fx, 'T-10', { owner: '' });
  const j = report(fx);
  assert.deepEqual(ids(j.dead), ['T-1', 'T-9']);
  assert.deepEqual(ids(j.unknownOwners), ['T-5', 'T-7']);
});

test('--apply clears only owner and adds a note; a second run and a done todo get no line', () => {
  const fx = fixture();
  transcript(fx, 'deadbeef', 25 * HOUR);
  todo(fx, 'T-1', { owner: 'deadbeef', status: 'active', state: 'half done', next: 'finish it' });
  todo(fx, 'T-2', { owner: 'deadbeef', status: 'done' });
  todo(fx, 'T-3', { owner: 'nofileyy' });
  const file = join(fx.home, 'todo.jsonl');
  const j = report(fx, '--apply');
  assert.deepEqual(j.applied, [{ action: 'cleared', id: 'T-1', owner: 'deadbeef' }]);
  const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 4);
  assert.deepEqual(Object.keys(lines[3].set).sort(), ['note', 'owner']);
  assert.equal(lines[3].from, 'testsess');
  const t = folded(fx).get('T-1');
  assert.equal(t.owner, '');
  assert.equal(t.status, 'active');
  assert.equal(t.state, 'half done');
  assert.equal(t.next, 'finish it');
  assert.match(t.notes[0], /deadbeef/);
  assert.match(t.notes[0], /25 hours/);
  assert.equal(folded(fx).get('T-3').owner, 'nofileyy');
  const after = readFileSync(file, 'utf8');
  assert.deepEqual(report(fx, '--apply').applied, []);
  assert.equal(readFileSync(file, 'utf8'), after);
  assert.equal(cli(fx, ['todo', 'start', 'T-1']).status, 0);
  assert.equal(folded(fx).get('T-1').owner, 'testsess');
});

test('--apply outside a session writes from: owner', () => {
  const fx = fixture();
  transcript(fx, 'deadbeef', 25 * HOUR);
  todo(fx, 'T-1', { owner: 'deadbeef' });
  const r = cli(fx, ['tidy', '--apply'], { CLAUDE_CODE_SESSION_ID: '' });
  assert.equal(r.status, 0, r.stderr);
  const last = readFileSync(join(fx.home, 'todo.jsonl'), 'utf8').trim().split('\n').at(-1);
  assert.equal(JSON.parse(last).from, 'owner');
});

test('no projects folder: nothing is dead, and orphans and candidates still work', () => {
  const fx = fixture();
  todo(fx, 'T-1', { owner: 'deadbeef' });
  todo(fx, 'T-2', {}, 15 * DAY);
  stream(fx, 'old'); board(fx, 'note', 'old');
  const j = report(fx);
  assert.deepEqual(j.dead, []);
  assert.deepEqual(ids(j.unknownOwners), ['T-1']);
  assert.equal(j.orphans.length, 1);
  assert.deepEqual(ids(j.candidates), ['T-2']);
});

test('clearDead: an owner set after the snapshot survives, an unchanged dead owner is cleared', () => {
  const dead = [{ id: 'T-1', owner: 'deadbeef', hours: 30 }, { id: 'T-2', owner: 'deadbeef', hours: 30 }, { id: 'T-3', owner: 'deadbeef', hours: 30 }];
  const now = new Map([['T-1', { owner: 'newowner', status: 'active' }], ['T-2', { owner: 'deadbeef', status: 'active' }], ['T-3', { owner: 'deadbeef', status: 'done' }]]);
  const written = [];
  const out = clearDead(dead, () => now, (id, set) => written.push([id, set.owner]));
  assert.deepEqual(out, [{ action: 'cleared', id: 'T-2', owner: 'deadbeef' }]);
  assert.deepEqual(written, [['T-2', '']]);
});

// ---- orphans ----

test('orphans: a stream file and the three scratch files are deleted, and nothing else', () => {
  const fx = fixture();
  board(fx, 'note', 'old');
  const files = [stream(fx, 'old', 25 * HOUR), scratch(fx, 'old-prompt.txt', 25 * HOUR), scratch(fx, 'old-run.jsonl', 25 * HOUR), scratch(fx, 'old-run.jsonl.err', 25 * HOUR)];
  const j = report(fx, '--apply');
  assert.equal(j.applied.filter((a) => a.action === 'deleted').length, 4);
  for (const f of files) assert.equal(existsSync(f), false, f);
  assert.ok(existsSync(join(fx.home, 'desk.config.json')));
});

test('orphans: each guard alone keeps the file', () => {
  const cases = {
    worktree: { arrange: (fx) => worktree(fx, 'old'), listed: false },
    'open todo': { arrange: (fx) => todo(fx, 'T-1', { slug: 'old' }), listed: false },
    'active todo': { arrange: (fx) => todo(fx, 'T-1', { slug: 'old', status: 'active' }), listed: false },
    'under 24 hours': { arrange: (fx) => stream(fx, 'old', HOUR), listed: /24 hours/ },
    'no history': { history: false, listed: /not provably/ },
  };
  for (const [name, { arrange, listed, history = true }] of Object.entries(cases)) {
    const fx = fixture();
    const f = stream(fx, 'old');
    if (history) board(fx, 'note', 'old');
    arrange?.(fx);
    const j = report(fx, '--apply');
    assert.ok(existsSync(f), `${name}: file survives`);
    assert.deepEqual(j.orphans, [], name);
    const kept = j.kept.filter((k) => k.file === f); // the fake worktree's folder is kept too: git cannot list the missing repo
    if (listed) assert.match(kept[0].reason, listed, name);
    else assert.deepEqual(kept, [], `${name}: normal, not listed`);
  }
});

test('orphans: a closed todo or a desk-<slug> board line is history enough', () => {
  const viaTodo = fixture();
  const a = stream(viaTodo, 'old');
  todo(viaTodo, 'T-1', { slug: 'old', status: 'done' });
  report(viaTodo, '--apply');
  assert.equal(existsSync(a), false);

  const viaDesk = fixture();
  const b = scratch(viaDesk, 'old-run.jsonl');
  board(viaDesk, 'note', 'desk-old');
  report(viaDesk, '--apply');
  assert.equal(existsSync(b), false);
});

test('orphans: other file names survive and are not listed', () => {
  const fx = fixture();
  for (const s of ['report', 'old', 'Bad_Name', 'sub']) board(fx, 'note', s);
  const files = ['report.txt', 'old-run.log', 'Bad_Name-run.jsonl', join('sub', 'old-run.jsonl')].map((n) => scratch(fx, n));
  const j = report(fx, '--apply');
  for (const f of files) assert.ok(existsSync(f), f);
  assert.deepEqual([j.orphans, j.kept], [[], []]);
});

test('orphans: with no worktrees folder every candidate is kept and listed', () => {
  const fx = fixture({ wts: false });
  board(fx, 'note', 'old');
  const f = stream(fx, 'old');
  const j = report(fx, '--apply');
  assert.ok(existsSync(f));
  assert.deepEqual(j.orphans, []);
  assert.match(j.kept[0].reason, /worktrees folder missing/);
});

test('orphans: a configured scratchDir is honoured and the default folder is left alone', () => {
  const fx = fixture({ cfg: { scratchDir: 'elsewhere' } });
  board(fx, 'note', 'old');
  const moved = aged(join(fx.home, 'elsewhere', 'old-run.jsonl'), 30 * DAY), usual = scratch(fx, 'old-run.jsonl');
  report(fx, '--apply');
  assert.equal(existsSync(moved), false);
  assert.ok(existsSync(usual));
});

test('hostile slugs in todo and board lines cannot reach a file outside streams and scratch', () => {
  const fx = fixture();
  const hostile = ['../out', '..\\out', 'a/../../out', '../../out', '..', '.', fx.root, join(fx.root, 'out')];
  hostile.forEach((slug, i) => { board(fx, 'note', slug); board(fx, 'merged', slug); todo(fx, `T-${i + 1}`, { slug, status: 'done' }); });
  const planted = [join(fx.root, 'out.md'), join(fx.root, 'out-run.jsonl'), join(fx.home, 'out.md'), join(fx.home, 'out-run.jsonl'), join(fx.home, 'scratch', 'sub', 'out-run.jsonl'), join(fx.home, 'streams', 'sub', 'out.md')].map((f) => aged(f, 30 * DAY));
  // Names a slug must not match, inside the folders themselves.
  const dotted = [scratch(fx, '..-run.jsonl'), scratch(fx, '.hidden-run.jsonl'), stream(fx, '..'), stream(fx, '-dash')];
  board(fx, 'note', 'old');
  const control = stream(fx, 'old');
  const j = report(fx, '--apply');
  assert.equal(existsSync(control), false, 'the control proves deletes were running');
  for (const f of [...planted, ...dotted]) assert.ok(existsSync(f), f);
  assert.deepEqual(j.orphans.map((o) => o.slug), ['old']);
  assert.deepEqual(j.kept, []);
  assert.doesNotMatch(JSON.stringify(j), /out-run|out\.md/);
});

test('links are never followed: a linked folder counts as empty and a link is not a regular file', () => {
  const fx = fixture();
  const outside = join(fx.root, 'outside');
  const target = aged(join(outside, 'old.md'), 30 * DAY), logs = aged(join(outside, 'old-run.jsonl'), 30 * DAY);
  board(fx, 'note', 'old');
  symlinkSync(outside, join(fx.home, 'streams'), 'junction'); // the whole folder is a link
  mkdirSync(join(fx.home, 'scratch'));
  symlinkSync(outside, join(fx.home, 'scratch', 'old-run.jsonl'), 'junction'); // an entry named like a log
  const j = report(fx, '--apply');
  assert.deepEqual([j.orphans, j.kept], [[], []]);
  for (const f of [target, logs]) assert.ok(existsSync(f), f);
  assert.ok(existsSync(join(fx.home, 'scratch', 'old-run.jsonl')));
});

test('deleteOrphans: a failed delete is reported and the run goes on; a path outside its folder is refused', () => {
  const dir = join(tmp(), 'streams'), removed = [];
  const remove = (f) => {
    if (f.endsWith('held.md')) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    if (f.endsWith('gone.md')) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
    removed.push(f);
  };
  const out = deleteOrphans([
    { file: join(dir, 'held.md'), dir },
    { file: join(dir, '..', 'escape.md'), dir },
    { file: join(dir, 'gone.md'), dir },
    { file: join(dir, 'next.md'), dir },
  ], remove);
  assert.deepEqual(out.map((o) => o.action), ['failed', 'failed', 'deleted', 'deleted']);
  assert.equal(out[0].error, 'EBUSY');
  assert.deepEqual(removed, [join(dir, 'next.md')]);
});

// ---- candidates ----

test('candidates: finished, stale and watch are listed once, and --apply changes no status', () => {
  const fx = fixture();
  board(fx, 'merged', 's');
  board(fx, 'merged', 'stillthere'); worktree(fx, 'stillthere');
  worktree(fx, 'held'); board(fx, 'claim', 'held');
  todo(fx, 'T-1', { slug: 's' });
  todo(fx, 'T-2', {});
  todo(fx, 'T-3', { parent: 'T-2', status: 'done' });
  todo(fx, 'T-4', { parent: 'T-2', status: 'dropped' });
  todo(fx, 'T-5', {}, 15 * DAY);
  todo(fx, 'T-6', {}, 15 * DAY);
  todo(fx, 'T-7', { parent: 'T-6' });
  todo(fx, 'T-8', { slug: 'held' }, 15 * DAY);
  todo(fx, 'T-9', { area: 'idea' }, 90 * DAY);
  todo(fx, 'T-10', { area: 'owner' }, 90 * DAY);
  todo(fx, 'T-11', { area: 'watch' }, 15 * DAY);
  todo(fx, 'T-12', { area: 'watch' }, DAY);
  todo(fx, 'T-13', { slug: 's' }, 15 * DAY); // both finished and old: finished wins
  todo(fx, 'T-14', { slug: 'stillthere' });
  todo(fx, 'T-15', {}, 15 * DAY);
  line(join(fx.home, 'todo.jsonl'), { ts: new Date().toISOString(), from: 'someone', id: 'T-15', set: { note: 'still alive' } });
  const before = new Map([...folded(fx)].map(([id, x]) => [id, x.status]));
  const j = report(fx, '--apply');
  const kinds = Object.fromEntries(j.candidates.map((x) => [x.id, x.kind]));
  assert.deepEqual(kinds, { 'T-1': 'finished', 'T-2': 'finished', 'T-5': 'stale', 'T-11': 'watch', 'T-13': 'finished' });
  for (const [id, x] of folded(fx)) if (before.has(id)) assert.equal(x.status, before.get(id), id);
});

// ---- the owner question ----

test('owner question: one todo with source and tidyIds, and options desk decide can split', () => {
  const fx = fixture();
  todo(fx, 'T-1', {}, 15 * DAY);
  todo(fx, 'T-2', {}, 20 * DAY);
  const j = report(fx, '--apply');
  assert.deepEqual(j.applied, [{ action: 'raised', id: 'T-3', tidyIds: 'T-1,T-2' }]);
  const q = folded(fx).get('T-3');
  assert.equal(q.area, 'owner');
  assert.equal(q.source, 'tidy');
  assert.equal(q.tidyIds, 'T-1,T-2');
  assert.match(q.title, /2 todos/);
  assert.ok(q.summary.length > 0 && q.summary.length <= 60);
  const d = cli(fx, ['decide']);
  assert.match(d.stdout, /Tidy found: T-1 stale, T-2 stale/);
  assert.match(d.stdout, /Recommended: Close them one by one/);
  assert.match(d.stdout, /Or: Keep them all open/);
});

test('owner question: nothing to ask raises nothing', () => {
  const fx = fixture();
  todo(fx, 'T-1', {});
  assert.deepEqual(report(fx, '--apply').applied, []);
  assert.equal(folded(fx).size, 1);
});

test('owner question: never while one is open, never again for a kept id, and only new ids after that', () => {
  const fx = fixture();
  todo(fx, 'T-1', {}, 15 * DAY);
  report(fx, '--apply'); // raises T-2
  todo(fx, 'T-3', {}, 15 * DAY);
  assert.deepEqual(report(fx, '--apply').applied, [], 'one is open');
  assert.equal(folded(fx).get('T-2').tidyIds, 'T-1', 'the open todo is not updated');
  assert.equal(folded(fx).get('T-1').status, 'open');

  line(join(fx.home, 'todo.jsonl'), { ts: new Date().toISOString(), from: 'owner', id: 'T-2', set: { status: 'done', note: 'keep them' } });
  const next = report(fx, '--apply');
  assert.deepEqual(next.applied, [{ action: 'raised', id: 'T-4', tidyIds: 'T-3' }], 'only the new id');
  assert.equal(folded(fx).get('T-1').status, 'open', 'a ruling is not acted on');

  line(join(fx.home, 'todo.jsonl'), { ts: new Date().toISOString(), from: 'owner', id: 'T-4', set: { status: 'done' } });
  const size = folded(fx).size;
  const again = report(fx, '--apply');
  assert.deepEqual(again.applied, [], 'kept ids are not raised again');
  assert.equal(folded(fx).size, size);
  assert.deepEqual(ids(report(fx).candidates), ['T-1', 'T-3'], 'a plain report still lists them');
});

test('owner question: a long list keeps both options and every id in tidyIds', () => {
  const fx = fixture();
  for (let i = 1; i <= 200; i++) todo(fx, `T-${i}`, {}, 15 * DAY);
  report(fx, '--apply');
  const q = folded(fx).get('T-201');
  assert.equal(q.tidyIds.split(',').length, 200);
  assert.ok(q.why.length <= 1000);
  assert.deepEqual(q.options.map((o) => o.label), ['Close them one by one', 'Keep them all open']);
});

test('owner question: a todo added after the snapshot keeps its id, the question takes the next one', () => {
  const now = new Map([['T-1', { status: 'open' }], ['T-2', { status: 'open' }]]); // T-2 was added after the snapshot
  const written = [];
  const out = raiseQuestion([{ id: 'T-1', kind: 'stale' }], () => now, (id) => written.push(id));
  assert.deepEqual(out, [{ action: 'raised', id: 'T-3', tidyIds: 'T-1' }]);
  assert.deepEqual(written, ['T-3']);
});

test('--apply on everything at once leaves board.jsonl byte-identical', () => {
  const fx = fixture();
  transcript(fx, 'deadbeef', 25 * HOUR);
  todo(fx, 'T-1', { owner: 'deadbeef' }, 15 * DAY);
  board(fx, 'note', 'old');
  const f = stream(fx, 'old');
  const ctx = aged(join(fx.home, 'context', 'T-1.md'), 30 * DAY);
  const before = readFileSync(join(fx.home, 'board.jsonl'), 'utf8');
  const j = report(fx, '--apply');
  assert.deepEqual(j.applied.map((a) => a.action), ['cleared', 'deleted', 'raised']);
  assert.equal(existsSync(f), false);
  assert.equal(existsSync(ctx), true);
  assert.equal(readFileSync(join(fx.home, 'board.jsonl'), 'utf8'), before);
  // The snapshot before the writes: clearing T-1 resets `updated`, yet this run still asks about it.
  assert.equal(folded(fx).get('T-2').tidyIds, 'T-1');
});

// ---- stray worktree folders ----

function gitFixture() {
  const fx = fixture(), dir = repo(fx.root, 'a', { remote: false });
  git(dir, 'worktree', 'add', '-q', '-b', 'agent/live', join(fx.home, 'wts', 'a-live'));
  return fx;
}

test('strays: an unknown folder is reported, a known worktree is not, and --apply keeps the files', () => {
  const fx = gitFixture();
  const keep = aged(join(fx.home, 'wts', 'a-gone', 'mine.txt'), 30 * DAY);
  mkdirSync(join(fx.home, 'wts', 'notes')); // outside the naming scheme
  writeFileSync(join(fx.home, 'wts', 'a-file'), 'x'); // a file, not a folder
  mkdirSync(join(fx.home, 'wts', 'a-Bad_Name')); // not a valid slug
  for (const args of [[], ['--apply']]) {
    const j = report(fx, ...args);
    assert.deepEqual(j.strayFolders.map((s) => s.dir.replace(/\\/g, '/').split('/').pop()), ['a-gone']);
    assert.deepEqual(j.kept, []);
    assert.equal(existsSync(keep), true);
  }
  assert.match(tidy(fx).stdout, /a-gone/);
});

test('strays: a failing git worktree list keeps the folders instead of flagging them', () => {
  const fx = fixture(); // repo path ../a does not exist
  mkdirSync(join(fx.home, 'wts', 'a-gone'));
  const j = report(fx, '--apply');
  assert.deepEqual(j.strayFolders, []);
  assert.equal(j.kept.length, 1);
  assert.match(j.kept[0].reason, /git worktree list failed/);
  assert.equal(existsSync(join(fx.home, 'wts', 'a-gone')), true);
});

test('strays: a worktrees folder under a linked parent flags only the stray', () => {
  const fx = fixture({ wts: false, cfg: { worktreesDir: '../lnk/wts' } }), dir = repo(fx.root, 'a', { remote: false });
  const real = join(fx.root, 'real'), wts = join(real, 'wts');
  mkdirSync(wts, { recursive: true }); symlinkSync(real, join(fx.root, 'lnk'), 'junction');
  git(dir, 'worktree', 'add', '-q', '-b', 'agent/live', join(wts, 'a-live'));
  mkdirSync(join(wts, 'a-gone'));
  symlinkSync(real, join(wts, 'a-linked'), 'junction'); // a link inside the folder is not followed or listed
  assert.deepEqual(report(fx).strayFolders.map((s) => s.dir.replace(/\\/g, '/').split('/').pop()), ['a-gone']);
});

test('strays: a worktrees folder that is itself a link is scanned, and --apply changes nothing', () => {
  const fx = fixture({ wts: false, cfg: { worktreesDir: 'lnk' } }), dir = repo(fx.root, 'a', { remote: false });
  const real = join(fx.root, 'real');
  mkdirSync(real); symlinkSync(real, join(fx.home, 'lnk'), 'junction');
  git(dir, 'worktree', 'add', '-q', '-b', 'agent/live', join(real, 'a-live'));
  aged(join(real, 'a-gone', 'mine.txt'), 30 * DAY);
  aged(join(fx.root, 'outside', 'keep.txt'), 30 * DAY);
  const before = snapshot(fx.root);
  for (const args of [[], ['--apply']]) {
    const j = report(fx, ...args);
    assert.deepEqual(j.strayFolders.map((s) => s.dir.replace(/\\/g, '/').split('/').pop()), ['a-gone']);
    assert.deepEqual(j.applied, []);
  }
  assert.deepEqual(snapshot(fx.root), before);
});

