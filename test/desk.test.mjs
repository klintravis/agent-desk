import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, desk, multiDesk } from './helpers.mjs';
import { validate, schema, deskFileWarnings } from '../lib/schema.mjs';

test('desk --self-test (board, todo, tokens, status, watch, decide, schema)', () => {
  const r = desk(tmp(), '--self-test');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('one version: desk --version, package.json and plugin.json agree', () => {
  const v = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8')).version;
  assert.equal(desk(tmp(), '--version').stdout.trim(), v('../package.json'));
  assert.equal(v('../.claude-plugin/plugin.json'), v('../package.json'));
});

test('desk home: a DESK_HOME folder without desk.config.json exits 1, with one prints it', () => {
  const home = tmp();
  const r = desk(home, 'home');
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  assert.equal(desk(home, 'home').stdout.trim(), home);
});

// Files as an older single-repo desk wrote them: claims without `repo`, todos with area `repo`,
// worktree folders named ikit-<slug>.
function legacyDesk() {
  const root = tmp(), home = join(root, 'desk');
  mkdirSync(join(root, 'worktrees', 'ikit-live'), { recursive: true });
  writeFileSync(join(root, 'worktrees', 'ikit-live', '.git'), 'gitdir: x\n');
  mkdirSync(home);
  writeFileSync(join(home, 'desk.config.json'), JSON.stringify({ worktreesDir: '../worktrees', repos: [{ id: 'kit', path: '../kit', worktreePrefix: 'ikit-' }] }));
  const ts = '2026-01-01T00:00:00.000Z';
  writeFileSync(join(home, 'board.jsonl'), [
    { ts, from: 'aaaa1111', kind: 'claim', slug: 'live', text: 'old claim' },
    { ts, from: 'aaaa1111', kind: 'claim', slug: 'gone', text: 'worktree removed' },
    'not json, a torn line',
  ].map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');
  writeFileSync(join(home, 'todo.jsonl'), [
    { ts, from: 'aaaa1111', id: 'T-1', set: { title: 'legacy repo work', status: 'open', area: 'repo', prio: 1 } },
    { ts, from: 'aaaa1111', id: 'T-2', set: { title: 'desk tooling', status: 'open', area: 'desk', prio: 2 } },
  ].map((l) => JSON.stringify(l)).join('\n') + '\n');
  return home;
}

test('legacy files: claims without repo resolve to the first repo, area repo files under it', () => {
  const home = legacyDesk();
  const before = readFileSync(join(home, 'board.jsonl'), 'utf8') + readFileSync(join(home, 'todo.jsonl'), 'utf8');
  const claims = desk(home, 'board', 'claims');
  assert.equal(claims.status, 0, claims.stderr);
  assert.match(claims.stdout, /^live aaaa1111/);
  assert.doesNotMatch(claims.stdout, /gone/);
  assert.match(desk(home, 'board', 'check', 'live').stdout, /claimed by aaaa1111/);
  assert.match(desk(home, 'todo', 'list', '--area', 'kit').stdout, /T-1 \[open\] legacy repo work/);
  assert.match(desk(home, 'todo', 'next').stdout, /^T-1 /);
  const st = desk(home, 'status');
  assert.equal(st.status, 0, st.stderr);
  assert.match(st.stdout, /## Claims\n- live/);
  assert.equal(readFileSync(join(home, 'board.jsonl'), 'utf8') + readFileSync(join(home, 'todo.jsonl'), 'utf8'), before, 'read commands must not write');
  assert.notEqual(desk(home, 'todo', 'md').status, 0, 'todo md is gone');
  assert.equal(existsSync(join(home, 'TODO.md')), false);
});

test('validate flags prototype-named keys under additionalProperties: false', () => {
  const s = { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false };
  const errs = validate(s, JSON.parse('{"a":"x","constructor":1,"__proto__":2,"toString":3}'));
  assert.equal(errs.length, 3);
});

test('written lines carry v: 1 and validate; decide records the ruling in decisions.jsonl; decide --list', () => {
  const home = tmp(), s = (n) => schema(n), last = (f) => JSON.parse(readFileSync(join(home, f), 'utf8').trim().split('\n').pop());
  assert.equal(desk(home, 'todo', 'add', 'pick one', '--area', 'owner', '--why', 'keep; drop').status, 0);
  assert.equal(desk(home, 'board', 'post', 'note', 'some-slug', 'hello').status, 0);
  assert.equal(last('todo.jsonl').v, 1);
  assert.deepEqual(validate(s('todo'), last('todo.jsonl')), []);
  assert.deepEqual(validate(s('board'), last('board.jsonl')), []);
  assert.equal(desk(home, 'decide', '--list').stdout, 'No rulings recorded.\n');
  const r = desk(home, 'decide', 'T-1', 'keep', 'it');
  assert.equal(r.status, 0, r.stderr);
  const d = last('decisions.jsonl');
  assert.deepEqual([d.v, d.todo, d.title, d.text, d.date], [1, 'T-1', 'pick one', 'keep it', d.ts.slice(0, 10)]);
  assert.deepEqual(validate(s('decisions'), d), []);
  assert.match(desk(home, 'todo', 'show', 'T-1').stdout, /done/);
  assert.equal(desk(home, 'decide', '--list').stdout, `# Rulings recorded\n- ${d.date} (T-1): pick one: keep it\n`);
  assert.notEqual(desk(home, 'decide', 'T-1', 'again').status, 0, 'a closed decision cannot be ruled twice');
  assert.equal(existsSync(join(home, 'NEXT.md')), false);
});

test('status --json validates against desk-status schema', () => {
  const { home } = multiDesk();
  assert.equal(desk(home, 'wt', 'new', 'demo', '--repo', 'a').status, 0);
  assert.equal(desk(home, 'todo', 'add', 'pick one', '--area', 'owner').status, 0);
  const r = desk(home, 'status', '--json');
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepEqual(validate(schema('desk-status'), o), []);
  assert.deepEqual(o.decisions.map((x) => x.title), ['pick one']);
  assert.deepEqual(o.claims.map((c) => c.slug), ['demo']);
  const rest = (s) => s.split('\n').slice(1).join('\n');
  assert.equal(rest(o.text), rest(desk(home, 'status').stdout));
});

test('desk check: a bad desk-file line is a warning (deskFileWarnings), at most 5 per file', () => {
  const home = tmp(), ts = '2026-11-01T00:00:00.000Z';
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  writeFileSync(join(home, 'todo.jsonl'), [JSON.stringify({ ts, from: 'a', id: 'T-1', set: { status: 'open' } }), JSON.stringify({ ts, from: 'a', id: 'X', set: {} }), 'torn'].join('\n') + '\n');
  writeFileSync(join(home, 'board.jsonl'), Array(7).fill(JSON.stringify({ ts, from: 'a', kind: 'nope', slug: 's' })).join('\r\n') + '\r\n');
  assert.deepEqual(deskFileWarnings(home), [
    'warn todo.jsonl:2: /id: must match ^T-\\d+$', 'warn todo.jsonl:3: does not parse',
    ...[1, 2, 3, 4, 5].map((n) => `warn board.jsonl:${n}: /kind: must be one of claim, release, ci, merged, verdict, note`), 'warn board.jsonl: +2 more',
  ]);
  assert.match(desk(home, 'todo', 'list', '--all').stdout, /T-1/, 'readers stay lenient');
});

test('todo add: the only repo by default, --area required with several repos', () => {
  const home = legacyDesk();
  assert.equal(desk(home, 'todo', 'add', 'new work').status, 0);
  assert.match(desk(home, 'todo', 'show', 'T-3').stdout, /kit/);
  writeFileSync(join(home, 'desk.config.json'), JSON.stringify({ repos: [{ id: 'a', path: 'a' }, { id: 'b', path: 'b' }] }));
  const r = desk(home, 'todo', 'add', 'which repo');
  assert.notEqual(r.status, 0);
});

test('todo add: --prio must be an integer; a title starting with -- needs --', () => {
  const home = tmp();
  const file = join(home, 'todo.jsonl'), read = () => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };
  for (const bad of ['abc', '1.5', '']) {
    const r = desk(home, 'todo', 'add', 'x', '--area', 'desk', '--prio', bad);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--prio needs an integer/);
  }
  assert.notEqual(desk(home, 'todo', 'add', 'x', '--area', 'desk', '--prio').status, 0);
  assert.equal(read(), '', 'a rejected add writes nothing');
  assert.equal(desk(home, 'todo', 'add', 'num', '--area', 'desk', '--prio', '3').status, 0);
  assert.equal(JSON.parse(read().trim().split('\n').pop()).set.prio, 3);
  assert.equal(desk(home, 'todo', 'add', '--area', 'desk', '--', '--foo bar').status, 0);
  assert.equal(JSON.parse(read().trim().split('\n').pop()).set.title, '--foo bar');
});

test('todo split prints the parent and the children it made, whatever their area', () => {
  const home = tmp();
  desk(home, 'todo', 'add', 'thought', '--area', 'idea');
  assert.match(desk(home, 'todo', 'split', 'T-1', 'a').stdout, /^T-1 .*\n {2}T-2 \[open\] a · idea\n$/);
  assert.match(desk(home, 'todo', 'split', 'T-1', 'b', '--area', 'desk').stdout, /^T-1 .*\n {2}T-3 \[open\] b · desk\n$/);
});

test('todo flags: a value starting with -- or missing is rejected; --all takes no value', () => {
  const home = tmp();
  const file = join(home, 'todo.jsonl'), read = () => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };
  for (const args of [
    ['--area', 'desk', 'real title', '--why is this lost', '--size', 'tiny'],
    ['--area', 'desk', '--urgent', '--size', 'tiny'],
  ]) {
    const r = desk(home, 'todo', 'add', ...args);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /needs a value/);
  }
  assert.equal(read(), '', 'a rejected add writes nothing');
  assert.equal(desk(home, 'todo', 'add', 'alpha', '--area', 'desk').status, 0);
  assert.equal(desk(home, 'todo', 'add', 'bravo', '--area', 'owner').status, 0);
  const out = desk(home, 'todo', 'list', '--all', '--area', 'desk').stdout;
  assert.match(out, /alpha/);
  assert.doesNotMatch(out, /bravo/);
});
