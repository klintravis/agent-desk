import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, desk, multiDesk, env, BIN, KIT } from './helpers.mjs';
import { validate, schema, deskFileWarnings } from '../lib/schema.mjs';
import { statusData, carry, watchDiff } from '../bin/desk.mjs';

test('a byte-order mark on line 1 of todo.jsonl does not hide that record', () => {
  const home = tmp();
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  const rec = { ts: '2026-01-01T00:00:00Z', from: 'aaaa1111', id: 'T-1', set: { title: 'first line todo', status: 'open', area: 'desk', prio: 1 } };
  writeFileSync(join(home, 'todo.jsonl'), `\u{FEFF}${JSON.stringify(rec)}\n`);
  assert.match(desk(home, 'todo', 'list').stdout, /T-1 \[open\] first line todo/);
});

test('desk --self-test is gone: usage error, no checks run', () => {
  const r = desk(tmp(), '--self-test');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^usage: desk /);
});

test('desk tokens --json: every row carries its transcript file name', () => {
  const home = tmp(), fake = tmp();
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  const proj = join(fake, '.claude', 'projects', home.replace(/[^a-zA-Z0-9]/g, '-')), sid = 'abcdef12-0000';
  mkdirSync(join(proj, sid, 'subagents'), { recursive: true });
  const line = JSON.stringify({ type: 'assistant', requestId: 'r1', message: { model: 'claude-x', usage: { input_tokens: 5, output_tokens: 1 } } });
  writeFileSync(join(proj, sid + '.jsonl'), line + '\n');
  writeFileSync(join(proj, sid, 'subagents', 'agent-0123.jsonl'), line + '\n');
  const r = spawnSync(process.execPath, [BIN, 'tokens', '--json'], { cwd: home, env: { ...env(home), HOME: fake, USERPROFILE: fake }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).map((x) => x.file).sort(), [sid + '.jsonl', 'agent-0123.jsonl']);
});

// A fake home with a desk (worktreesDir "wts", repos given by prefix) and transcripts: [{ name, cwd, brief, fresh, subs: [{ name, brief, fresh }] }].
// No worktree folder exists, so every case also holds for a removed worktree.
function tokensDesk(prefixes, sessions, ...args) {
  const home = tmp(), fake = tmp();
  writeFileSync(join(home, 'desk.config.json'), JSON.stringify({ worktreesDir: 'wts', repos: prefixes.map((p) => { const id = p.replace('!', ''); return { id, path: '../' + id, worktreePrefix: id + '-', ...(p.endsWith('!') ? { kind: 'folder' } : {}) }; }) }));
  const proj = join(fake, '.claude', 'projects', home.replace(/[^a-zA-Z0-9]/g, '-'));
  // s.then = { cwd, brief }: a second user row, later in the transcript, with its own cwd; s.read = cache read tokens
  const text = (s, fresh) => [
    ...(s.brief === undefined ? [] : [JSON.stringify({ type: 'user', cwd: s.cwd ?? home, message: { content: s.brief } })]),
    ...(fresh === null ? [] : [JSON.stringify({ type: 'assistant', cwd: s.cwd ?? home, requestId: 'r', timestamp: s.at ?? new Date().toISOString(), message: { model: s.model ?? 'claude-x', usage: { input_tokens: fresh, cache_read_input_tokens: s.read ?? 0, output_tokens: 1 } } })]),
    ...(s.then ? [JSON.stringify({ type: 'user', cwd: s.then.cwd ?? s.cwd ?? home, message: { content: s.then.brief } })] : []),
  ].join('\n') + '\n';
  for (const s of sessions) {
    mkdirSync(join(proj, s.name, 'subagents'), { recursive: true });
    writeFileSync(join(proj, s.name + '.jsonl'), text(s, s.fresh ?? 1));
    for (const a of s.subs ?? []) {
      writeFileSync(join(proj, s.name, 'subagents', a.name + '.jsonl'), text(a, a.fresh === undefined ? 1 : a.fresh));
      if (a.meta) writeFileSync(join(proj, s.name, 'subagents', a.name + '.meta.json'), JSON.stringify(a.meta));
    }
  }
  if (args[0] === 'status') {
    const r = spawnSync(process.execPath, [BIN, ...args], { cwd: home, env: { ...env(home), HOME: fake, USERPROFILE: fake }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return { out: r.stdout, home, rows: null, status: JSON.parse(r.stdout) };
  }
  const r = spawnSync(process.execPath, [BIN, 'tokens', ...args], { cwd: home, env: { ...env(home), HOME: fake, USERPROFILE: fake }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { out: r.stdout, home, rows: args.includes('--json') ? JSON.parse(r.stdout) : null };
}
const keys = (t) => Object.fromEntries(t.rows.map((r) => [r.file.replace('.jsonl', ''), r.worktree]));

test('desk tokens: depth, parent, first call and the gap since the last spawn of a type and model', () => {
  const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
  const sessions = [{ name: 'm', read: 7, subs: [
    { name: 'r3', at: ago(30), fresh: 10, meta: { agentType: 'kit:rev', spawnDepth: 2, parentAgentId: 'afc459781a6d8831f' } },
    { name: 'r1', at: ago(100), fresh: 10, read: 9000, meta: { agentType: 'kit:rev', spawnDepth: 1 } },
    { name: 'n1', at: ago(20), fresh: 5 }, // no meta file at all
  ] }, { name: 'm2', subs: [ // r2 is in another session and still follows r1; y1 is another model, so it starts its own gap
    { name: 'r2', at: ago(98), fresh: 10, read: 9000, meta: { agentType: 'kit:rev', effort: 'low', spawnDepth: 1 } }, // effort does not split a type
    { name: 'y1', at: ago(99), fresh: 10, model: 'claude-y', meta: { agentType: 'kit:rev', spawnDepth: 1 } },
  ] }];
  const t = tokensDesk([], sessions, '--json');
  const row = Object.fromEntries(t.rows.map((r) => [r.file.replace('.jsonl', ''), r]));
  assert.deepEqual([row.m.depth, row.m.parent, row.r1.depth, row.r1.parent, row.r3.depth, row.r3.parent, row.n1.depth, row.n1.parent], [0, '', 1, 'main', 2, 'afc459781a6d8831f', 1, 'main']);
  assert.deepEqual([row.r1.firstFresh, row.r1.firstRead], [10, 9000]);
  assert.equal(row.r1.sinceSpawn, null);
  assert.equal(row.r2.sinceSpawn, 120);
  assert.equal(row.y1.sinceSpawn, null);
  assert.equal(row.r3.sinceSpawn, 68 * 60);
  assert.equal(row.n1.sinceSpawn, null);
  assert.ok(!('sinceSpawn' in row.m), 'a main session is not spawned');
  const lines = tokensDesk([], sessions).out.trim().split('\n');
  assert.match(lines.at(-3), /^subagents: 5 runs \(1 nested\), first call 100% of fresh, 4k cache reads per call$/);
  assert.match(lines.at(-2), /<5m 1\/1, 5-60m 0\/0, >60m 0\/1, first 1\/3$/);
  assert.match(lines.at(-1), /^total: /);
  assert.match(lines.find((l) => l.includes('kit:rev: r3') || l.includes('afc45978')), /2 {2}afc45978$/);
  assert.ok(!tokensDesk([], sessions, '--by-worktree').out.includes('subagents:'));
  assert.ok(!tokensDesk([], [{ name: 'm' }]).out.includes('subagents:'), 'no pattern lines without a subagent');
});

test('desk tokens: worktree key of main sessions and subagents', () => {
  const MARK = 'BRIEFMARKER';
  const t = tokensDesk(['adesk'], [
    { name: 'm1', brief: `${MARK} nothing here`, subs: [
      { name: 's-a', brief: `${MARK} work in C:\\x\\WTS\\adesk-A, and /c/x/wts/adesk-b`, cwd: 'C:\\x\\wts\\adesk-b' },
      { name: 's-none', brief: `${MARK} no path`, cwd: 'C:\\x\\wts\\adesk-b' },
      { name: 's-nowt', brief: `${MARK} see wts/other-a and elsewhere/adesk-a and xwts/adesk-a` },
      { name: 's-later', brief: 'no path', then: { brief: 'now wts/adesk-late' } }, // only the first user row counts
    ] },
    { name: 'm2', brief: `${MARK} stream for c:/x/wts/adesk-c` },
    { name: 'm3', cwd: '/c/x/wts/adesk-d/sub', brief: `${MARK} names /wts/adesk-e` },
    { name: 'm4', brief: 'x', then: { cwd: 'C:\\x\\wts\\adesk-moves', brief: 'wts/adesk-moves' } }, // first cwd wins: it moves later
    { name: 'm5', brief: 'wts/adesk-f then wts/adesk-g' },
  ], '--json');
  assert.deepEqual(keys(t), { m1: '(desk)', 's-a': 'a', 's-none': '(desk)', 's-nowt': '(desk)', 's-later': '(desk)', m2: 'c', m3: 'd', m4: '(desk)', m5: 'f' });
  assert.ok(!t.out.includes(MARK), 'a brief never reaches the output');
  assert.ok(t.rows.every((r) => !('brief' in r) && !('cwd' in r)));
});

test('desk tokens: a subagent without a brief worktree takes its parent key; several repos tag the key', () => {
  const t = tokensDesk(['one', 'two'], [
    { name: 'm', brief: 'go to wts/two-a', subs: [{ name: 's1', brief: 'nothing' }, { name: 's2', brief: 'wts/one-b' }] },
  ], '--json');
  assert.deepEqual(keys(t), { m: 'two:a', s1: 'two:a', s2: 'one:b' });
  assert.deepEqual(Object.values(keys(tokensDesk([], [{ name: 'm', brief: 'wts/x-a' }], '--json'))), ['(desk)']);
  // "!" = a folder repo: it counts for the tag (as in desk overlap), so one git repo plus a folder still tags
  assert.deepEqual(Object.values(keys(tokensDesk(['one', 'docs!'], [{ name: 'm', brief: 'wts/one-a' }], '--json'))), ['one:a']);
});

test('status --json: a subagent is named by type/effort and description, without the plugin prefix', () => {
  const o = tokensDesk([], [{ name: 'm', subs: [{ name: 'a', meta: { agentType: 'agent-desk:reviewer', effort: 'high', description: 'x' } }] }], 'status', '--json').status;
  assert.deepEqual(o.sessions[0].agents, [{ type: 'reviewer/high', about: 'x' }]);
  assert.deepEqual(validate(schema('desk-status'), o), []);
});

test('desk tokens --by-worktree: one row per worktree, largest fresh first, total as without the flag', () => {
  const sessions = [
    { name: 'm1', fresh: 1000, subs: [{ name: 'a1', brief: 'wts/adesk-a', fresh: 2000, read: 3000 }, { name: 'b1', brief: 'wts/adesk-b', fresh: 5000 }, { name: 'a2', brief: 'wts/adesk-a', fresh: 1000 }] },
  ];
  const t = tokensDesk(['adesk'], sessions, '--by-worktree');
  const lines = t.out.trim().split('\n');
  assert.deepEqual(lines.slice(2, 5).map((l) => l.trim().split(/\s+/)[0]), ['b', 'a', '(desk)']);
  assert.ok(!/peak|time/.test(t.out));
  assert.match(lines[3], /^a\s+2\s+3k\s+2\s+50%$/); // calls, fresh, out, cache share of the two a transcripts
  const plain = tokensDesk(['adesk'], sessions);
  assert.equal(lines.at(-1), plain.out.trim().split('\n').at(-1));
  assert.match(lines.at(-1), /^total: 4 calls, fresh 9k,/);
  assert.deepEqual(keys(tokensDesk(['adesk'], sessions, '--by-worktree', '--json')).a1, 'a'); // --json ignores the flag
  // a key whose transcripts have no calls has no row
  assert.ok(!tokensDesk(['adesk'], [{ name: 'm', subs: [{ name: 'z', brief: 'wts/adesk-z', fresh: null }] }], '--by-worktree').out.includes('\nz '));
  // with --session only that session is grouped
  const one = tokensDesk(['adesk'], [{ name: 'aaaaaaaa1', fresh: 7 }, { name: 'bbbbbbbb1', brief: 'wts/adesk-q', fresh: 9 }], '--by-worktree', '--session', 'bbbbbbbb');
  assert.match(one.out, /\nq /); assert.ok(!one.out.includes('(desk)'));
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

test('todo add|set|start refuse a --status outside the schema and a --parent that makes a cycle or does not exist; nothing is written', () => {
  const home = tmp(), file = join(home, 'todo.jsonl'), A = ['--area', 'desk'];
  for (const t of ['a', 'b']) assert.equal(desk(home, 'todo', 'add', t, ...A).status, 0);
  assert.equal(desk(home, 'todo', 'set', 'T-2', '--parent', 'T-1').status, 0);
  const before = readFileSync(file, 'utf8');
  for (const args of [
    ['set', 'T-1', '--status', 'finished'], ['start', 'T-1', '--status', 'finished'], ['add', 'c', ...A, '--status', 'finished'],
    ['set', 'T-1', '--parent', 'T-1'], ['set', 'T-1', '--parent', 'T-2'], ['set', 'T-1', '--parent', 'T-9'],
    ['split', 'T-1', 'x', '--status', 'finished'], ['add', 'c', ...A, '--parent', 'T-9'], ['start', 'T-1', '--parent', 'T-9'],
  ]) {
    const r = desk(home, 'todo', ...args);
    assert.equal(r.status, 1, args.join(' '));
    assert.equal(readFileSync(file, 'utf8'), before, `${args.join(' ')} wrote`);
    if (args.includes('T-9')) assert.match(r.stderr, /no todo T-9/);
  }
  assert.equal(desk(home, 'todo', 'set', 'T-1', '--status', 'blocked').status, 0);
});

test('a dangling parent already in todo.jsonl does not block a write; split children always hang under the split todo', () => {
  const home = tmp(), file = join(home, 'todo.jsonl'), A = ['--area', 'desk'];
  for (const t of ['a', 'b']) assert.equal(desk(home, 'todo', 'add', t, ...A).status, 0);
  appendFileSync(file, JSON.stringify({ ts: '2026-01-01T00:00:00.000Z', from: 'x', id: 'T-3', set: { title: 'c', status: 'open', area: 'desk', parent: 'T-99' } }) + '\n');
  const r = desk(home, 'todo', 'set', 'T-2', '--parent', 'T-3');
  assert.equal(r.status, 0, r.stderr);
  for (const p of ['T-99', 'T-4']) assert.equal(desk(home, 'todo', 'split', 'T-1', 'x', '--parent', p).status, 0);
  assert.equal(JSON.parse(desk(home, 'todo', 'show', 'T-4').stdout).parent, 'T-1');
  assert.equal(JSON.parse(desk(home, 'todo', 'show', 'T-5').stdout).parent, 'T-1');
});

test('todo words: add and note join them; done --note; empty note, bare set refused; caps warn; start names the old owner', () => {
  const home = tmp(), file = join(home, 'todo.jsonl'), run = (...a) => desk(home, 'todo', ...a);
  assert.equal(run('add', 'one', 'two', 'three', '--area', 'desk').status, 0);
  assert.equal(run('note', 'T-1', 'a', 'b', 'c').status, 0);
  assert.equal(run('done', 'T-1', '--note', 'fin').status, 0);
  const x = JSON.parse(run('show', 'T-1').stdout);
  assert.equal(x.title, 'one two three');
  assert.deepEqual(x.notes.map((n) => n.replace(/^\S+ \S+: /, '')), ['a b c', 'fin']);
  const before = readFileSync(file, 'utf8');
  for (const args of [['note', 'T-1', ''], ['set', 'T-1', 'words'], ['set', 'T-1', '--note', ''], ['add', '   ', '--area', 'desk'], ['split', 'T-1', 'ok', ' ']]) {
    assert.equal(run(...args).status, 1, args.join(' '));
    assert.equal(readFileSync(file, 'utf8'), before, `${args.join(' ')} wrote`);
  }
  assert.match(run('add', 'x'.repeat(200), '--area', 'desk').stderr, /title cut to its 160-character cap/);
  appendFileSync(file, JSON.stringify({ ts: '2026-01-01T00:00:00.000Z', from: 'x', id: 'T-1', set: { status: 'active', owner: 'someone' } }) + '\n');
  const r = run('start', 'T-1');
  assert.equal(r.status, 0);
  assert.match(r.stderr, /taking over T-1 from someone/);
  // a blocked todo with an owner is also a takeover
  appendFileSync(file, JSON.stringify({ ts: '2026-01-01T00:00:00.000Z', from: 'x', id: 'T-1', set: { status: 'blocked', owner: 'other' } }) + '\n');
  assert.match(run('start', 'T-1').stderr, /taking over T-1 from other/);
  // set --title takes the 160 cap and its warning; --slug "" still clears
  assert.match(run('set', 'T-1', '--title', 'y'.repeat(200)).stderr, /title cut to its 160-character cap/);
  assert.equal(JSON.parse(run('show', 'T-1').stdout).title.length, 160);
  assert.equal(run('set', 'T-1', '--slug', '').status, 0);
  // done keeps --why and --note both
  assert.equal(run('done', 'T-1', '--why', 'a', '--note', 'b').status, 0);
  const notes = JSON.parse(run('show', 'T-1').stdout).notes;
  assert.match(notes[notes.length - 1], /a; b$/);
  // an over-long option why warns
  assert.match(run('add', 'q', '--area', 'owner', '--option', `A: ${'z'.repeat(1100)}`, '--option', 'B: no').stderr, /option why cut to its 1000-character cap/);
});

test('todo commands refuse unknown flags and extra words, naming them and writing nothing', () => {
  const home = tmp(), file = join(home, 'todo.jsonl');
  for (const t of ['a', 'b']) assert.equal(desk(home, 'todo', 'add', t, '--area', 'desk').status, 0);
  const before = readFileSync(file, 'utf8');
  const bad = [
    ...['done', 'drop', 'block', 'open'].flatMap((c) => [[c, 'T-1', '--reason', 'x', '/--reason/'], [c, 'T-1', 'T-2', '/"T-2"/'], [c, 'T-1', '--why', 'ok', '--all', '/--all/']]),
    ['note', 'T-1', '--why', 'x', '/--why/'], ['note', 'T-1', '--reason', 'x', '/--reason/'],
    ['note', 'T-1', 'fixed', 'the', '--force', 'path', '/goes after --/'],
    ['done', 'T-1', '--option', 'a: b', '--option', 'c: d', '/--option(?!s)/'],
    ['done', 'T-1', '--__proto__', 'x', '/--__proto__/'],
    ['set', 'T-1', '--sumary', 'x', '/--sumary/'], ['set', 'T-1', 'junk', '--title', 'x', '/"junk"/'], ['set', 'T-1', '--all', 'x', '/--all/'],
    ['add', 't', '--area', 'desk', '--reason', 'x', '/--reason/'],
    ['start', 'T-1', '--foo', 'x', '/--foo/'], ['start', 'T-1', 'T-2', '/"T-2"/'],
    ['split', 'T-1', 'c', '--foo', 'x', '/--foo/'],
  ];
  for (const a of bad) {
    const re = a.pop(), r = desk(home, 'todo', ...a);
    assert.equal(r.status, 1, a.join(' '));
    assert.equal(r.stdout, '', a.join(' '));
    assert.match(r.stderr, new RegExp(re.slice(1, -1)), a.join(' '));
    assert.equal(readFileSync(file, 'utf8'), before, `${a.join(' ')} wrote`);
  }
  // the forms the skills use still work
  assert.equal(desk(home, 'todo', 'note', 'T-1', 'a', 'b', 'c').status, 0);
  assert.equal(desk(home, 'todo', 'note', 'T-1', '--', '--odd text').status, 0);
  assert.equal(desk(home, 'todo', 'done', 'T-1', '--why', 'w', '--note', 'n').status, 0);
  assert.equal(JSON.parse(desk(home, 'todo', 'show', 'T-1').stdout).status, 'done');
  assert.equal(desk(home, 'todo', 'drop', 'T-2').status, 0);
});

test('todo refuses --id, --created and --notes; a jsonl already holding a string notes line still lists and takes notes', () => {
  const home = tmp(), file = join(home, 'todo.jsonl');
  assert.equal(desk(home, 'todo', 'add', 'a', '--area', 'desk').status, 0);
  const before = readFileSync(file, 'utf8');
  for (const k of ['id', 'created', 'notes']) for (const args of [['set', 'T-1'], ['add', 'c', '--area', 'desk'], ['start', 'T-1']]) {
    assert.equal(desk(home, 'todo', ...args, `--${k}`, 'x').status, 1, `${args[0]} --${k}`);
    assert.equal(readFileSync(file, 'utf8'), before, `${args[0]} --${k} wrote`);
  }
  assert.equal(desk(home, 'todo', 'note', 'T-1', 'first').status, 0);
  appendFileSync(file, JSON.stringify({ ts: '2026-01-01T00:00:00.000Z', from: 'x', id: 'T-1', set: { notes: 'old', id: 'Z' } }) + '\n');
  assert.equal(desk(home, 'todo', 'list').status, 0);
  assert.equal(desk(home, 'todo', 'note', 'T-1', 'new').status, 0);
  const x = JSON.parse(desk(home, 'todo', 'show', 'T-1').stdout);
  assert.equal(x.id, 'T-1');
  assert.deepEqual(x.notes.map((n) => n.replace(/^\S+ \S+: /, '')), ['first', 'old', 'new']);
  assert.equal(desk(home, 'todo', 'show', 'Z').status, 1);
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
  assert.equal(r.stdout, 'Recorded T-1: keep it\n\nNo owner decisions waiting.\n'); // a Decide press reads this: one line, then the next decision
  const d = last('decisions.jsonl');
  assert.deepEqual([d.v, d.todo, d.title, d.text, d.date], [1, 'T-1', 'pick one', 'keep it', d.ts.slice(0, 10)]);
  assert.deepEqual(validate(s('decisions'), d), []);
  assert.match(desk(home, 'todo', 'show', 'T-1').stdout, /done/);
  assert.equal(desk(home, 'decide', '--list').stdout, `# Rulings recorded\n- ${d.date} (T-1): pick one: keep it\n`);
  assert.notEqual(desk(home, 'decide', 'T-1', 'again').status, 0, 'a closed decision cannot be ruled twice');
  assert.equal(existsSync(join(home, 'NEXT.md')), false);
});

test('a ruled owner todo that is started is not waiting; a never-ruled started one still is', () => {
  const home = tmp(), waiting = () => JSON.parse(desk(home, 'status', '--json').stdout).decisions.map((d) => d.id);
  assert.equal(desk(home, 'todo', 'add', 'ruled one', '--area', 'owner').status, 0);
  assert.equal(desk(home, 'todo', 'add', 'never ruled', '--area', 'owner').status, 0);
  assert.equal(desk(home, 'decide', 'T-1', 'go').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-1').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-2').status, 0);
  assert.deepEqual(waiting(), ['T-2'], 'status --json');
  const st = JSON.parse(desk(home, 'status', '--json').stdout);
  assert.ok(st.active.some((x) => x.id === 'T-1'), 'ruled, started: in active');
  assert.ok(st.todos.some((x) => x.id === 'T-1'), 'ruled, started: in todos');
  assert.ok(!st.active.some((x) => x.id === 'T-2'), 'never ruled: not in active');
  assert.match(st.text, /T-1/);
  assert.equal(JSON.parse(desk(home, 'decide', '--json').stdout).id, 'T-2');
  assert.match(desk(home, 'decide').stdout, /^T-2 \(1 of 1\)/);
  assert.notEqual(desk(home, 'decide', 'T-1', 'again').status, 0, 'a started ruled todo cannot be ruled again');
  assert.equal(desk(home, 'decide', 'T-2', 'ok').status, 0);
  assert.equal(desk(home, 'decide').stdout, 'No owner decisions waiting.\n');
});

test('a ruled owner todo waits again when reopened, and a new ruling replaces the old one', () => {
  const home = tmp(), waiting = () => JSON.parse(desk(home, 'status', '--json').stdout).decisions.map((d) => d.id);
  assert.equal(desk(home, 'todo', 'add', 'q', '--area', 'owner').status, 0);
  assert.equal(desk(home, 'decide', 'T-1', 'one').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-1').status, 0);
  assert.deepEqual(waiting(), []);
  assert.equal(desk(home, 'todo', 'set', 'T-1', '--status', 'open').status, 0);
  assert.deepEqual(waiting(), ['T-1'], 'reopened: waiting again');
  assert.equal(desk(home, 'decide', 'T-1', 'two').status, 0);
  assert.deepEqual(waiting(), []);
  assert.match(desk(home, 'decide', '--list').stdout, /two/);
});

test('a ruled owner todo that is blocked waits', () => {
  const home = tmp(), waiting = () => JSON.parse(desk(home, 'status', '--json').stdout).decisions.map((d) => d.id);
  assert.equal(desk(home, 'todo', 'add', 'q', '--area', 'owner').status, 0);
  assert.equal(desk(home, 'decide', 'T-1', 'one').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-1').status, 0);
  assert.deepEqual(waiting(), []);
  assert.equal(desk(home, 'todo', 'set', 'T-1', '--status', 'blocked').status, 0);
  assert.deepEqual(waiting(), ['T-1']);
});

test('a ruled, started owner todo on a claimed slug is in active and out of todos and decisions', () => {
  const { home } = multiDesk();
  assert.equal(desk(home, 'todo', 'add', 'ruled work', '--area', 'owner').status, 0);
  assert.equal(desk(home, 'decide', 'T-1', 'go').status, 0);
  assert.equal(desk(home, 'wt', 'new', 'foo', '--repo', 'a').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-1', '--slug', 'foo').status, 0);
  const st = JSON.parse(desk(home, 'status', '--json').stdout);
  assert.ok(st.active.some((x) => x.id === 'T-1'), 'in active');
  assert.ok(!st.todos.some((x) => x.id === 'T-1') && !st.decisions.some((x) => x.id === 'T-1'));
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

test('status --json: todos holds what is open and not in Work, owner and idle ideas stay out; v stays 2', () => {
  const { home } = multiDesk();
  assert.equal(desk(home, 'wt', 'new', 'demo', '--repo', 'a').status, 0);
  const add = (title, area = 'a', ...rest) => assert.equal(desk(home, 'todo', 'add', title, '--area', area, ...rest).status, 0);
  add('later', 'a', '--prio', '30'); // T-1
  add('first', 'a', '--prio', '1'); // T-2
  add('held'); // T-3
  add('verify live', 'watch'); // T-4
  add('ruling', 'owner'); // T-5
  add('a thought', 'idea'); // T-6
  add('on the claim'); // T-7
  add('started, no worktree'); // T-8
  add('finished'); // T-9
  add('active thought', 'idea'); // T-10
  assert.equal(desk(home, 'todo', 'block', 'T-3').status, 0);
  assert.equal(desk(home, 'todo', 'set', 'T-7', '--slug', 'demo').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-7').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-8').status, 0);
  assert.equal(desk(home, 'todo', 'done', 'T-9').status, 0);
  assert.equal(desk(home, 'todo', 'start', 'T-10').status, 0); // an active idea shows; T-6 stays out
  const o = JSON.parse(desk(home, 'status', '--json').stdout);
  assert.equal(o.v, 2);
  assert.deepEqual(validate(schema('desk-status'), o), []);
  assert.deepEqual(o.todos.map((x) => x.id), ['T-8', 'T-10', 'T-2', 'T-1', 'T-3', 'T-4']); // active first, then priority, then id
  assert.ok(o.active.some((x) => x.id === 'T-7')); // the Work join still has it
  const idle = multiDesk().home;
  assert.deepEqual(JSON.parse(desk(idle, 'status', '--json').stdout).todos, []);
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
  assert.match(r.stderr, /several repos/);
  assert.doesNotMatch(r.stderr, /refused/, 'several repos is not a refused config');
  rmSync(join(home, 'desk.config.json'));
  const none = desk(home, 'todo', 'add', 'no config');
  assert.equal(none.status, 1);
  assert.doesNotMatch(none.stderr, /refused/, 'a missing config is not a refused one');
  writeFileSync(join(home, 'desk.config.json'), JSON.stringify({ repos: [{ id: 'a' }] }));
  const bad = desk(home, 'todo', 'add', 'refused config');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /add needs --area .*\(desk\.config\.json refused: .+\)/);
});

test('todo note: kept whole up to 1000 characters, refused over it; unquoted words are joined; --notes is refused', () => {
  const home = tmp();
  assert.notEqual(desk(home, 'todo', 'add', 'x', '--area', 'desk', '--notes', 'see PR').status, 0, 'a reserved key is refused, nothing written');
  assert.equal(desk(home, 'todo', 'add', 'x', '--area', 'desk').status, 0);
  const claim = `accept: ${'c'.repeat(330)} | npm test -- x | exit 0`;
  assert.equal(desk(home, 'todo', 'note', 'T-1', claim).status, 0);
  assert.equal(desk(home, 'todo', 'note', 'T-1', 'accept:', 'x', 'y').status, 0);
  assert.deepEqual(JSON.parse(desk(home, 'todo', 'show', 'T-1').stdout).notes.map((n) => n.split(': ').slice(1).join(': ')), [claim, 'accept: x y']);
  assert.notEqual(desk(home, 'todo', 'set', 'T-1', '--note', 'n'.repeat(1001)).status, 0, 'set --note shares the cap');
  const long = desk(home, 'todo', 'note', 'T-1', 'n'.repeat(1001));
  assert.notEqual(long.status, 0); assert.match(long.stderr, /over 1000; nothing was written/);
  assert.equal(desk(home, 'todo', 'list').status, 0);
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

test('todo summary: add and set store it (cut to 60), status --json carries it, todo show keeps the title', () => {
  const home = tmp();
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  assert.equal(desk(home, 'todo', 'add', 'a long title for the full question', '--area', 'desk', '--summary', 'short one').status, 0);
  assert.equal(desk(home, 'todo', 'add', 'no summary yet', '--area', 'desk').status, 0);
  assert.equal(desk(home, 'todo', 'set', 'T-2', '--summary', 'x'.repeat(100)).status, 0);
  desk(home, 'todo', 'start', 'T-1');
  desk(home, 'todo', 'start', 'T-2');
  const o = JSON.parse(desk(home, 'status', '--json').stdout);
  assert.deepEqual(validate(schema('desk-status'), o), []);
  assert.deepEqual(o.active.map((x) => x.summary), ['short one', 'x'.repeat(60)]);
  assert.match(desk(home, 'todo', 'show', 'T-1').stdout, /"title": "a long title for the full question"/);
});

test('todo split prints the parent and the children it made, whatever their area', () => {
  const home = tmp();
  desk(home, 'todo', 'add', 'thought', '--area', 'idea');
  assert.match(desk(home, 'todo', 'split', 'T-1', 'a').stdout, /^T-1 .*\n {2}T-2 \[open\] a · idea\n$/);
  assert.match(desk(home, 'todo', 'split', 'T-1', 'b', '--area', 'desk').stdout, /^T-1 .*\n {2}T-3 \[open\] b · desk\n$/);
});

test('todo --option: repeats collect, split at the first ": ", other flags still overwrite, validates', () => {
  const home = tmp();
  const r = desk(home, 'todo', 'add', 'q', '--area', 'owner', '--why', 'first', '--why', 'second',
    '--option', 'Refuse: safe: at a cost; rarely', '--option', 'Allow', '--option', '  Wait  :  a while  ');
  assert.equal(r.status, 0, r.stderr);
  const line = JSON.parse(readFileSync(join(home, 'todo.jsonl'), 'utf8').trim());
  assert.equal(line.set.why, 'second');
  assert.deepEqual(line.set.options, [{ label: 'Refuse', why: 'safe: at a cost; rarely' }, { label: 'Allow' }, { label: 'Wait', why: 'a while' }]);
  assert.deepEqual(validate(schema('todo'), line), []);
  assert.equal(desk(home, 'todo', 'set', 'T-1', '--option', 'a: x', '--option', 'b: y').status, 0);
  assert.deepEqual(JSON.parse(desk(home, 'decide', '--json').stdout).options, [{ label: 'a', why: 'x' }, { label: 'b', why: 'y' }]);
});

test('todo --option: fewer than 2, more than 4, an empty or a long label, or --options write nothing', () => {
  const home = tmp();
  const file = join(home, 'todo.jsonl');
  const long = 'x'.repeat(61);
  for (const [args, msg] of [
    [['--option', 'one: x'], /2 to 4/],
    [['--option', 'a', '--option', 'b', '--option', 'c', '--option', 'd', '--option', 'e'], /2 to 4/],
    [['--option', `${long}: x`, '--option', 'b'], /60/],
    [['--option', ': x', '--option', 'b'], /label/],
    [['--option', 'Keep: because a', '--option', 'Keep: because b'], /same label/],
    [['--options', 'a'], /--option/],
  ]) {
    const r = desk(home, 'todo', 'add', 'q', '--area', 'owner', ...args);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.match(r.stderr, msg);
    assert.equal(existsSync(file), false, args.join(' '));
  }
  assert.equal(desk(home, 'todo', 'add', 'q', '--area', 'owner', '--option', `${'x'.repeat(60)}: x`, '--option', 'b').status, 0);
});

test('decide --json: the first waiting decision, old --why todos, null; a ruling records the label; status --json carries options', () => {
  const home = tmp(), T151 = 'Refuse (recommended): a hidden push cannot slip through, at the cost of rare false refusals, also for allowed pushes and from any directory; Allow as before: no false refusals, as the 2026-11-02 merge-policy design said, but an unparseable line can hide a push from this guard';
  assert.equal(desk(home, 'decide', '--json').stdout, 'null\n');
  desk(home, 'todo', 'add', 'old', '--area', 'owner', '--why', T151);
  desk(home, 'todo', 'add', 'new', '--area', 'owner', '--why', 'context; with a semicolon', '--option', 'Keep: it works', '--option', 'Drop: less code');
  const old = JSON.parse(desk(home, 'decide', '--json').stdout);
  assert.deepEqual([old.id, old.title, old.context, old.options.map((o) => o.label)], ['T-1', 'old', null, ['Refuse', 'Allow as before']]);
  assert.match(old.options[0].why, /^a hidden push/);

  const printed = desk(home, 'decide').stdout;
  assert.match(printed, /^T-1 \(1 of 2\): old\n {2}1\. Recommended: Refuse\n {4}a hidden push/);
  assert.match(printed, /\n {2}2\. Or: Allow as before\n {4}no false refusals/);
  // The hint teaches the forms that survive a shell: never a label or words in double quotes.
  assert.ok(printed.includes(`desk decide T-1 --pick <n>, counted from 1`), printed);
  assert.ok(printed.includes(`desk decide T-1 '<ruling>'`), printed);
  assert.ok(!printed.includes('"<ruling>"'), printed);

  const statusOf = () => JSON.parse(desk(home, 'status', '--json').stdout);
  assert.deepEqual(statusOf().decisions[1], { id: 'T-2', title: 'new', options: [{ label: 'Keep', why: 'it works' }, { label: 'Drop', why: 'less code' }] });
  assert.deepEqual(validate(schema('desk-status'), statusOf()), []);

  const r = desk(home, 'decide', 'T-1', 'Refuse');
  assert.match(r.stdout, /^Recorded T-1: Refuse\n\nT-2 \(1 of 1\): new\n {2}context; with a semicolon\n {2}1\. Recommended: Keep\n {4}it works\n {2}2\. Or: Drop\n {4}less code\n/);
  assert.deepEqual(JSON.parse(desk(home, 'decide', '--json').stdout), { id: 'T-2', title: 'new', context: 'context; with a semicolon', options: [{ label: 'Keep', why: 'it works' }, { label: 'Drop', why: 'less code' }] });
  // Free text stays allowed, and a ruling that reads like the flag is still a ruling.
  assert.equal(desk(home, 'decide', 'T-2', '--json').status, 0);
  assert.equal(JSON.parse(readFileSync(join(home, 'decisions.jsonl'), 'utf8').trim().split('\n').pop()).text, '--json');
});

const rulingsIn = (home) => {
  const f = join(home, 'decisions.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
};

test('decide --pick: records the nth label as --json lists it; a hostile label is stored whole; a bad pick closes nothing', () => {
  const home = tmp(), rulings = () => rulingsIn(home), hostile = 'x\\"; echo PWNED #';
  desk(home, 'todo', 'add', 'q', '--area', 'owner', '--option', 'keep: it works', '--option', `${hostile}: why`, '--why', 'c');
  const refused = (...pick) => {
    const r = desk(home, 'decide', 'T-1', ...pick);
    assert.equal(r.status, 1, pick.join(' '));
    assert.equal(r.stdout, '');
    assert.equal(rulings().length, 0);
    assert.equal(JSON.parse(desk(home, 'decide', '--json').stdout).id, 'T-1', 'the todo stays open');
    return r.stderr;
  };
  for (const n of ['0', '3', '-1', '1.5', '1e0', '0x1', 'two', '<2>', '']) assert.match(refused('--pick', n), /whole number from 1 to 2\. Nothing was recorded/, n);
  assert.match(refused('--pick'), /whole number/);
  assert.match(refused('--pick', '1', 'extra'), /whole number/);

  const r = desk(home, 'decide', 'T-1', '--pick', '2');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith(`Recorded T-1: ${hostile}\n`), r.stdout);
  assert.equal(rulings()[0].text, hostile);
  assert.deepEqual(JSON.parse(desk(home, 'todo', 'show', 'T-1').stdout).status, 'done');

  // The position counts on what --json lists, old --why todos too.
  desk(home, 'todo', 'add', 'old', '--area', 'owner', '--why', 'a; b (recommended)');
  assert.equal(desk(home, 'decide', 'T-2', '--pick', '1').status, 0);
  assert.equal(rulings()[1].text, 'b');

  desk(home, 'todo', 'add', 'bare', '--area', 'owner');
  const none = desk(home, 'decide', 'T-3', '--pick', '1');
  assert.equal(none.status, 1);
  assert.match(none.stderr, /T-3 has no options/);
  assert.equal(rulings().length, 2);
  assert.equal(JSON.parse(desk(home, 'decide', '--json').stdout).id, 'T-3');
  assert.equal(desk(home, 'decide', 'T-3', 'pick one yourself').status, 0, 'text that merely starts alike is a ruling');
  assert.equal(rulings()[2].text, 'pick one yourself');

  assert.match(desk(home, 'decide', 'T-99', '--pick', '1').stderr, /not a waiting owner decision/);
});

test('decide: --pick is a flag only as its own argument; one argument reading like it is the ruling', () => {
  const home = tmp(), rulings = () => rulingsIn(home);
  desk(home, 'todo', 'add', 'three', '--area', 'owner', '--why', 'Keep (recommended); --pick 3; Drop');
  assert.deepEqual(JSON.parse(desk(home, 'decide', '--json').stdout).options.map((o) => o.label), ['Keep', '--pick 3', 'Drop']);
  // The dialog and VS Code send a clicked label as one argument: flag reading would record Drop.
  assert.equal(desk(home, 'decide', 'T-1', '--pick 3').status, 0);
  assert.equal(rulings()[0].text, '--pick 3');

  desk(home, 'todo', 'add', 'two', '--area', 'owner', '--why', 'Reject (recommended); --pick 1');
  assert.equal(desk(home, 'decide', 'T-2', '--pick 1').status, 0);
  assert.equal(rulings()[1].text, '--pick 1', 'not Reject, option 1');

  desk(home, 'todo', 'add', 'lone', '--area', 'owner', '--option', 'a: x', '--option', 'b: y');
  const lone = desk(home, 'decide', 'T-3', '--pick');
  assert.equal(lone.status, 1);
  assert.match(lone.stderr, /whole number.*Nothing was recorded/);
  assert.equal(rulings().length, 2);
  assert.equal(JSON.parse(desk(home, 'decide', '--json').stdout).id, 'T-3', 'the todo stays open');
});

test('decide: --pick=2 as one argument is refused, nothing recorded, the todo stays open', () => {
  const home = tmp();
  desk(home, 'todo', 'add', 'q', '--area', 'owner', '--option', 'a: x', '--option', 'b: y');
  for (const v of ['--pick=2', ' --pick=2', '--pick=2 please']) {
    const r = desk(home, 'decide', 'T-1', v);
    assert.equal(r.status, 1, v);
    assert.match(r.stderr, /with a space.*Nothing was recorded/, v);
  }
  assert.doesNotMatch(desk(home, 'decide', 'T-1', '--pick=zzq7').stderr, /zzq7/, 'the refusal echoes nothing');
  assert.equal(rulingsIn(home).length, 0);
  assert.equal(JSON.parse(desk(home, 'decide', '--json').stdout).id, 'T-1');
});

test('--option refuses a value that reads as a flag once cleaned, as a label is stored', () => {
  const home = tmp();
  for (const v of [' --pick 3: x', '\t--pick 3: x', '‮--pick 3: x']) {
    const r = desk(home, 'todo', 'add', 'q', '--area', 'owner', '--option', v, '--option', 'b: y');
    assert.equal(r.status, 1, JSON.stringify(v));
    assert.match(r.stderr, /--option needs a value/);
  }
  assert.equal(desk(home, 'decide', '--json').stdout.trim(), 'null', 'nothing was added');
});

test('decide: an empty label is not an option; a pick that would rule nothing is refused', () => {
  const home = tmp(), rulings = () => rulingsIn(home);
  desk(home, 'todo', 'add', 'Bare', '--area', 'owner', '--why', '(recommended); b');
  assert.deepEqual(JSON.parse(desk(home, 'decide', '--json').stdout).options.map((o) => o.label), ['b']);
  assert.equal(desk(home, 'decide', 'T-1', '--pick', '1').status, 0, '--pick counts as --json lists');
  assert.equal(rulings()[0].text, 'b');

  // Only a hand-edited line can store these: the '' is dropped, the ' ' is a label until cleaned.
  const hand = { ts: new Date().toISOString(), from: 'x', id: 'T-2', set: { title: 'hand', status: 'open', area: 'owner', options: [{ label: '' }, { label: ' ' }, { label: 'b' }] } };
  appendFileSync(join(home, 'todo.jsonl'), JSON.stringify(hand) + '\n');
  assert.deepEqual(JSON.parse(desk(home, 'decide', '--json').stdout).options.map((o) => o.label), [' ', 'b']);
  const r = desk(home, 'decide', 'T-2', '--pick', '1');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /empty label.*Nothing was recorded/);
  assert.equal(rulings().length, 1);
  assert.equal(JSON.parse(desk(home, 'decide', '--json').stdout).id, 'T-2', 'the todo stays open');
});

test('decide: an sk- run with no digit is no key; one holding a digit is refused, whatever sits before it', () => {
  const home = tmp(), rulings = () => rulingsIn(home);
  desk(home, 'todo', 'add', 'q', '--area', 'owner', '--option', 'a: x', '--option', 'b: y');
  const key = `${'sk-'}${'a1B2'.repeat(6)}`;
  for (const words of [`use ${key}`, `key=${key}`, `first line\\n${key}`, `tab\\t${key}`, `key%3D${key}`, `apikey${key}`]) {
    assert.equal(desk(home, 'decide', 'T-1', words).status, 1, words);
    assert.equal(rulings().length, 0);
  }
  const sentence = `merge the ${'ri'}sk-based-rollout-for-every-branch first`;
  assert.equal(desk(home, 'decide', 'T-1', sentence).status, 0);
  assert.equal(rulings()[0].text, sentence);
});

test('decide refuses a secret: free text, a picked label, past the cut; no echo; a look-alike passes', () => {
  const home = tmp(), key = `sk-ant-${'a'.repeat(24)}`, rulings = () => rulingsIn(home);
  desk(home, 'todo', 'add', 'q', '--area', 'owner', '--option', `${key}: why`, '--option', 'plain: why');
  const pem = `${'x'.repeat(1000)} -----BEGIN ${'PRIVATE'} KEY-----\nabc\n-----END ${'PRIVATE'} KEY-----`;
  for (const args of [[`use ${key}`], ['--pick', '1'], [pem]]) {
    const r = desk(home, 'decide', 'T-1', ...args);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /shaped like a secret.*Nothing was recorded/);
    assert.ok(!(r.stderr + r.stdout).includes(key), 'the secret is never echoed');
    assert.equal(rulings().length, 0);
    assert.equal(JSON.parse(desk(home, 'decide', '--json').stdout).id, 'T-1', 'the todo stays open');
  }
  assert.ok(!readFileSync(join(home, 'todo.jsonl'), 'utf8').includes('ruled:'));
  assert.equal(desk(home, 'decide', 'T-1', 'sk-short is a fine name').status, 0);
  assert.equal(rulings()[0].text, 'sk-short is a fine name');
});

test('old --why decisions: a ; in prose never invents a broken label', () => {
  const home = tmp();
  for (const why of ['Options: a (recommended); b', 'plain sentence with no choice', 'b; a (recommended)', 'x: one; y: two; z', `${'l'.repeat(61)}: r; b: s`]) {
    desk(home, 'todo', 'add', why.slice(0, 10), '--area', 'owner', '--why', why);
  }
  const all = JSON.parse(desk(home, 'status', '--json').stdout).decisions.map((d) => d.options.map((o) => [o.label, o.why ?? null]));
  assert.deepEqual(all[0], [['a', null], ['b', null]]);
  assert.deepEqual(all[1], [['plain sentence with no choice', null]]);
  assert.deepEqual(all[2], [['a', null], ['b', null]]);
  assert.deepEqual(all[3], [['x: one', null], ['y: two', null], ['z', null]]); // not every part has a rationale: ambiguous, keep whole
  assert.equal(all[4][0][1], null);
});

test('old --why decisions: "Recommended: X; other: Y" keeps its parts whole', () => {
  const home = tmp();
  desk(home, 'todo', 'add', 'q', '--area', 'owner', '--why', 'Recommended: restore the rules; other: leave them removed');
  const labels = JSON.parse(desk(home, 'decide', '--json').stdout).options.map((o) => o.label);
  assert.equal(labels.length, 2);
  assert.ok(!labels.some((l) => /^(recommended|other)$/i.test(l)), labels.join('|'));
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

// ---- user settings: the file is always a temp one (helpers.mjs points every spawn away from a real one) ----
const settingsFile = (v) => { const f = join(tmp(), 'settings.json'); writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v)); return f; };
const withUser = (home, file, extra, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: home, env: { ...env(home), AGENT_DESK_SETTINGS: file, ...extra }, encoding: 'utf8' });
const settingsJson = (home, file, extra = {}) => { const r = withUser(home, file, extra, 'settings', '--json'); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const statusJson = (home, file) => { const r = withUser(home, file, {}, 'status', '--json'); assert.equal(r.status, 0, r.stderr); const j = JSON.parse(r.stdout); assert.deepEqual(validate(schema('desk-status'), j), []); return j; };
const editConfig = (home, f) => { const p = join(home, 'desk.config.json'); writeFileSync(p, JSON.stringify(f(JSON.parse(readFileSync(p, 'utf8'))))); };

test('desk settings --json: values, sources and the fields a skill reads', () => {
  const { home } = multiDesk(), f = settingsFile({ tasks: { review: { effort: 'medium' } } });
  const j = settingsJson(home, f);
  assert.deepEqual(Object.keys(j).sort(), ['active', 'cache', 'tasks', 'userFile', 'warnings']);
  assert.equal(j.userFile, f); assert.equal(j.active, true);
  assert.deepEqual(j.tasks.review, { agent: 'reviewer', task: 'review', model: 'opus', effort: 'medium', source: { model: 'kit', effort: 'user' }, shared: { model: 'opus', effort: 'high' } });
});

test('desk settings: a bad user file gives the desk values, a warning on stderr without its text, exit 0', () => {
  const { home } = multiDesk(), f = settingsFile('{"apiKey": "hunter2"');
  assert.equal(settingsJson(home, f).tasks.review.model, 'opus');
  const r = withUser(home, f, {}, 'settings');
  assert.equal(r.status, 0);
  assert.match(r.stderr, /^warn .*not valid JSON/m);
  assert.doesNotMatch(r.stdout + r.stderr, /hunter2/);
  assert.match(r.stdout, /^review: reviewer opus\/high/m);
  assert.match(r.stdout, /outside it/); // the limit is said once, on the text screen
});

test('desk settings outside a desk: the no-desk error, exit 1', () => {
  const r = spawnSync(process.execPath, [BIN, 'settings', '--json'], { cwd: tmp(), env: { ...env(''), DESK_HOME: '' }, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no desk here/);
});

test('desk settings: cache sources, env shadow, not applied until sync, Copilot advisory; writes nothing', () => {
  const { home } = multiDesk(), p = join(home, '.claude', 'settings.json');
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...(existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}), promptCacheTtl: '1h' }));
  assert.equal(desk(home, 'sync').status, 0);
  const f = settingsFile({ cache: { subagentPromptCacheTtl: '5m' } });
  const local = join(home, '.claude', 'settings.local.json'), before = readFileSync(local, 'utf8');
  const j = settingsJson(home, f);
  assert.deepEqual(j.cache, { promptCacheTtl: { value: '1h', source: 'desk' }, subagentPromptCacheTtl: { value: '5m', source: 'user' }, idleCompaction: { value: null, source: 'unset' } });
  assert.ok(j.warnings.some((w) => /cache\.subagentPromptCacheTtl is not applied yet: run desk sync/.test(w)), j.warnings.join());
  assert.equal(readFileSync(local, 'utf8'), before);
  assert.equal(withUser(home, f, {}, 'sync').status, 0);
  assert.ok(!settingsJson(home, f).warnings.some((w) => /not applied/.test(w)));
  const shadow = settingsJson(home, f, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m', CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL: '5m' }).warnings;
  for (const re of [/CLAUDE_CODE_PROMPT_CACHE_TTL is set: it takes precedence over promptCacheTtl/, /CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL is set: it takes precedence over subagentPromptCacheTtl/]) assert.ok(shadow.some((w) => re.test(w)));
  editConfig(home, (c) => ({ ...c, harnesses: ['claude', 'copilot'] }));
  assert.ok(settingsJson(home, f).warnings.some((w) => /advisory on Copilot/.test(w)));
});

test('desk settings: the not-ignored warning is in warnings, once, not on stderr with --json', () => {
  const { home } = multiDesk(), f = settingsFile({ cache: { subagentPromptCacheTtl: '5m' } });
  mkdirSync(join(home, '.claude'), { recursive: true });
  const local = join(home, '.claude', 'settings.local.json'); // tracked: check-ignore then says not ignored
  writeFileSync(local, '{}\n');
  spawnSync('git', ['-C', home, 'init', '-q']);
  spawnSync('git', ['-C', home, 'add', '-f', '.claude/settings.local.json']);
  const j = withUser(home, f, {}, 'settings', '--json');
  assert.equal(j.status, 0, j.stderr);
  const hits = JSON.parse(j.stdout).warnings.filter((w) => /not ignored by git/.test(w));
  assert.equal(hits.length, 1, j.stdout);
  assert.doesNotMatch(j.stderr, /not ignored/);
  const p = withUser(home, f, {}, 'settings');
  assert.equal(p.stderr.split('\n').filter((l) => /^warn .*not ignored by git/.test(l)).length, 1, p.stderr);
});

test('desk status: the user line and field name what runs below the shared values', () => {
  const { home } = multiDesk(), f = settingsFile({ tasks: { review: { model: 'sonnet', effort: 'medium' } } });
  const j = statusJson(home, f);
  assert.deepEqual(j.user, { file: f, below: [{ task: 'review', model: 'sonnet', effort: 'medium', shared: { model: 'opus', effort: 'high' } }], raised: [] });
  const line = j.text.split('\n')[1];
  for (const part of [f, 'review', 'sonnet/medium', 'opus/high']) assert.ok(line.startsWith('User settings ') && line.includes(part), line);
  assert.equal(withUser(home, f, {}, 'status').stdout.split('\n')[1], line);
});

test('desk status: a floor raising a user value shows on the line', () => {
  const { home } = multiDesk(), f = settingsFile({ tasks: { review: { model: 'sonnet' } } });
  editConfig(home, (c) => ({ ...c, floor: { review: { model: 'opus' } } }));
  const j = statusJson(home, f);
  assert.deepEqual(j.user.raised, [{ task: 'review', model: 'opus', effort: 'high', replaced: { model: 'sonnet' } }]);
  assert.deepEqual(j.user.below, []);
  assert.match(j.text.split('\n')[1], /review opus\/high \(floor raised model from sonnet\)/);
});

test('desk status: no user file, or none of its values accepted, leaves the screen alone', () => {
  const { home } = multiDesk();
  for (const f of [join(tmp(), 'absent.json'), settingsFile({ tasks: { review: { model: 'claude-opus-4-5' } } }), settingsFile('{nope')]) {
    const j = statusJson(home, f);
    assert.equal(j.user, null);
    assert.doesNotMatch(j.text, /User settings/);
    assert.match(j.text.split('\n')[1], /^## Owner decisions waiting/);
  }
});

test('the review verdict: the suffix survives the status data whole, even with a 40-character SHA', () => {
  const sha = 'a'.repeat(40);
  for (const text of [`MERGE @${sha} by sonnet/medium`, `FIXES NEEDED @${sha} by opus/xhigh; two findings`]) {
    const { branches } = statusData({ t: new Map(), board: [{ ts: '2026-11-01T00:00:00Z', from: 'aaaa', kind: 'verdict', slug: 'x', text }], rows: null, runs: null, heads: new Map([['x', sha]]) });
    assert.equal(branches[0].verdict, text);
  }
});

test('status --json: the branch state is computed in the CLI by the merge gate rule, and no reader parses CI or verdicts', () => {
  const head = 'a'.repeat(40), other = 'b'.repeat(40);
  const v = (text) => [{ ts: '2026-11-01T00:00:00Z', from: 'aaaa', kind: 'verdict', slug: 'x', text }];
  const run = (headSha, status, conclusion = '') => ({ headBranch: 'agent/x', headSha, status, conclusion });
  const state = (board, runs, extra = {}) => statusData({ t: new Map(), board, rows: null, runs, heads: new Map([['x', head]]), ...extra }).branches[0].state;
  const ok = v(`MERGE @${head}`), pass = run(head, 'completed', 'success');
  assert.equal(state(ok, [pass]), 'ready');
  assert.equal(state(ok, null), 'CI unknown');
  assert.equal(state(ok, []), 'no CI yet');
  assert.equal(state(ok, [run(other, 'completed', 'success')]), 'CI stale');
  assert.equal(state(ok, [run(other, 'completed', 'failure')]), 'CI stale'); // a failure on an older commit is not this head's
  assert.equal(state(ok, [pass, run(head, 'completed', 'failure')]), 'CI failed'); // T-108: all runs of the head, not the newest
  assert.equal(state(ok, [pass, run(head, 'in_progress')]), 'CI running');
  assert.equal(state(v(`MERGE @${other}`), [pass]), 'needs review');
  assert.equal(state([], [pass]), 'needs review');
  assert.equal(state(v(`FIXES NEEDED @${head}`), [pass]), 'fixes needed');
  assert.equal(state(ok, [pass], { behind: new Map([['x', { base: 'develop', n: 1 }]]) }), 'rebase');
  assert.equal(state(ok, null, { branches: new Map([['x', { branch: 'agent/x', gh: '' }]]) }), 'ready'); // a repo without gh has no CI to wait for
  assert.equal(state(ok, null, { branches: new Map([['x', { branch: 'agent/x', gh: '' }]]), pushed: new Map([['x', false]]) }), 'not pushed'); // the gate's first check
  const behind = { behind: new Map([['x', { base: 'develop', n: 1 }]]) }, old = run(other, 'completed', 'success');
  assert.equal(state(v(`MERGE AFTER FIXES @${head}`), [pass]), 'fixes needed');
  assert.equal(state(v('DO NOT MERGE'), [pass]), 'fixes needed'); // no sha: applies to any head
  assert.equal(state(v(`FIXES NEEDED @${other}`), [pass]), 'needs review');
  assert.equal(state(v(`FIXES @${head}`), [run(head, 'completed', 'failure')]), 'CI failed');
  assert.equal(state(ok, [run(head, 'completed', 'neutral')]), 'CI failed');
  assert.equal(state(v(`FIXES @${head}`), [old]), 'fixes needed');
  assert.equal(state(ok, [old], behind), 'rebase');
  assert.equal(state(v(`MERGE @${head.slice(0, 7)}`), [pass]), 'ready');
  assert.equal(state(v('MERGE @abc'), [pass]), 'needs review');
  assert.equal(state([], [pass], { branches: new Map([['x', { branch: 'agent/x', gh: '' }]]) }), 'needs review');
  const data = (text) => statusData({ t: new Map(), board: v(text), rows: null, runs: null, heads: new Map([['x', head]]) }).branches[0];
  assert.equal(data(`MERGE @${other}`).verdictOld, true);
  assert.equal('verdictOld' in data(`MERGE @${head}`), false);
  assert.equal('verdictOld' in data('MERGE'), false);
  // ci reads every run of the head: an older failure beside a newer pass still shows the failure
  const ci = (runs) => statusData({ t: new Map(), board: ok, rows: null, runs, heads: new Map([['x', head]]) }).branches[0].ci;
  assert.equal(ci([pass, run(head, 'completed', 'failure')]), `CI ${head.slice(0, 7)} failure`);
  assert.equal(ci([old]), `CI ${other.slice(0, 7)} success (not the head)`);
  // One place: the pane and the sidebar read `state` and carry no CI or verdict parser.
  for (const f of [['hooks', 'pane.tsx'], ['vscode', 'desk.js']]) assert.doesNotMatch(readFileSync(join(KIT, ...f), 'utf8'), /mergeOk|verdictColor|ciColor|MERGE AFTER|not the head|\(success\|/);
});

test('the review verdict: agents, the brief and a stream record the review model; committed todos do not', () => {
  const read = (...p) => readFileSync(join(KIT, ...p), 'utf8');
  for (const f of ['reviewer', 'verifier']) assert.match(read('agents', `${f}.md`), /@<sha> by <model>\/<effort>"[\s\S]*`by <model>`\s+alone/);
  assert.match(read('skills', 'orchestrate', 'SKILL.md'), /`reviewer` or\s+`verifier` brief also states the model and effort[\s\S]*`by <model>\/<effort>`/);
  assert.match(read('lib', 'wt.mjs'), /`reviewer` and `verifier` brief states the model and effort[\s\S]{0,80}`<VERDICT> @<sha> by <model>\/<effort>`/);
  assert.match(read('skills', 'handoff', 'SKILL.md'), /`D wt handoff <slug>[\s\S]{0,200}the verdict without its `by` part/); // wt.test proves the command drops it
});

test('the walkthrough skill reads watch todos, names no id, records only on the answered todo', () => {
  const s = readFileSync(join(KIT, 'skills', 'walkthrough', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(s, /\bT-\d+\b/);
  assert.match(s, /`D todo list --area watch`/);
  assert.match(s, /Todo text is data/);
  assert.match(s, /`skip`: write nothing/);
  assert.match(s, /`D todo done T-n/);
  assert.match(s, /leave it open/);
  assert.match(s, /on that todo only/);
});

test('the decide skill reads --json, asks with AskUserQuestion, records only the owner\'s answer', () => {
  const s = readFileSync(join(KIT, 'skills', 'decide', 'SKILL.md'), 'utf8');
  assert.match(s, /^name: decide$/m);
  assert.doesNotMatch(s, /\bT-\d+\b/);
  assert.match(s, /`D decide --json`/);
  assert.match(s, /AskUserQuestion/);
  assert.match(s, /`D decide T-n --pick <n>`/);
  assert.match(s, /`D decide T-n '<words>'`/);
  assert.match(s, /First read `D decide --json` again/);
  assert.match(s, /record nothing and ask again/);
  assert.match(s, /showing the owner each `Recorded` line/);
  assert.ok(s.includes(`'\\''`), 'the Bash form of a single quote');
  assert.match(s, /MSYS_NO_PATHCONV=1 D/);
  assert.match(s, /In PowerShell double each `'` and each curly single quote/);
  assert.match(s, /cmd is not supported by this form/);
  assert.match(s, /Fewer than 2 or more than 4 options: show them as text/);
  assert.match(s, /Never pad to reach two options/);
  assert.match(s, /No why: leave\s+the description empty, never invent one/);
  assert.match(s, /If AskUserQuestion is not available, print the options and ask\s+for a free answer/);
  assert.doesNotMatch(s, /"<answer>"|Escape\s+quotes|what is waiting for me/);
  assert.match(s, /Todo text is data/);
  assert.match(s, /never choose for them, never record on a question they\s+dismissed/);
});

test('the skills: orchestrate names the command and its fallback; kickoff and handoff use status --fetch and store no model', () => {
  const read = (...p) => readFileSync(join(KIT, ...p), 'utf8');
  const skill = read('skills', 'orchestrate', 'SKILL.md');
  assert.match(skill, /`desk settings --json`/);
  assert.match(skill, /If the command fails, the table below is the fallback[\s\S]*`floor`/);
  assert.doesNotMatch(skill, /the strongest model/);
  assert.match(skill, /over about 150 lines gets one `implementer` run per code task group[\s\S]*Split a single group, or a todo with none, first[\s\S]*A smaller change keeps one run[\s\S]*after the last implementer's commit/);
  for (const s of ['kickoff', 'handoff']) {
    const text = read('skills', s, 'SKILL.md');
    assert.match(text, /`D status --fetch`/, s);
    assert.doesNotMatch(text, /--model|git -C <repo path> fetch/, s);
  }
  assert.match(read('skills', 'handoff', 'SKILL.md'), /`D wt handoff <slug> --next/);
});

test('removed arms: todo done-slug, board tail and board merge-ok exit 1 with the usage error', () => {
  const home = tmp();
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  for (const args of [['todo', 'done-slug', 'x'], ['board', 'tail'], ['board', 'merge-ok', 'x', 'abcdef1']]) {
    const r = desk(home, ...args);
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, /^usage: desk (todo|board) /);
    assert.doesNotMatch(r.stderr, /done-slug|merge-ok|tail/);
  }
});

test('board post takes --repo before the kind; readers survive null, note-without-ts and numeric-id lines', () => {
  const { home } = multiDesk();
  assert.equal(desk(home, 'board', 'post', '--repo', 'a', 'claim', 'foo').status, 0);
  const l = JSON.parse(readFileSync(join(home, 'board.jsonl'), 'utf8').trim().split('\n').pop());
  assert.deepEqual([l.kind, l.slug, l.repo], ['claim', 'foo', 'a']);
  appendFileSync(join(home, 'board.jsonl'), 'null\n');
  assert.equal(desk(home, 'board', 'claims').status, 0, 'a null line');
  writeFileSync(join(home, 'todo.jsonl'), '{"from":"x","id":"T-1","set":{"title":"t","area":"a","status":"open","note":"n"}}\n{"id":5,"set":{"title":"n"}}\n');
  assert.equal(desk(home, 'todo', 'list').status, 0, 'a note with no ts');
  assert.equal(desk(home, 'todo', 'add', 'more', '--area', 'a').status, 0, 'a numeric id');
});

test('init: a repeated repo id, --harness without a value and a package.json with a BOM; an old .gitignore warns', () => {
  const home = tmp();
  let r = desk(home, 'init', '--no-install', '--repo', 'a=.', '--repo', 'a=.');
  assert.equal(r.status, 1);
  assert.equal(existsSync(join(home, 'desk.config.json')), false, 'nothing written');
  assert.match(desk(home, 'init', '--no-install', '--harness').stderr, /--harness needs a value/);
  writeFileSync(join(home, 'package.json'), String.fromCharCode(0xFEFF) + '{"name":"x"}');
  writeFileSync(join(home, '.gitignore'), 'node_modules/\n');
  r = desk(home, 'init', '--no-install');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /warn .*\.gitignore lacks board\.jsonl, .*\.claude\/settings\.local\.json/);
  assert.equal(readFileSync(join(home, '.gitignore'), 'utf8'), 'node_modules/\n', 'kept as it was');
});

test('board post with a bad kind or slug exits 1 and appends nothing; board check needs a slug', () => {
  const { home } = multiDesk();
  const lines = () => (existsSync(join(home, 'board.jsonl')) ? readFileSync(join(home, 'board.jsonl'), 'utf8') : '');
  const before = lines();
  const bad = desk(home, 'board', 'post', 'wibble', 'x');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /bad post/);
  assert.equal(desk(home, 'board', 'post', 'note', 'Bad_Slug').status, 1);
  assert.equal(lines(), before);
  const none = desk(home, 'board', 'check');
  assert.equal(none.status, 1);
  assert.match(none.stderr, /usage: desk board check <slug>/);
  assert.equal(desk(home, 'board', 'check', '').status, 1, 'an unset variable');
});

test('an internal post with bad input returns false and leaves the exit code alone', async () => {
  const { post } = await import('../bin/desk.mjs');
  const before = process.exitCode;
  assert.equal(post('wibble', 'x'), false);
  assert.equal(process.exitCode, before);
});

test('a refused config: board check on a foreign claim exits 1 and names the file and key, not unclaimed', () => {
  const home = legacyDesk();
  editConfig(home, (c) => ({ ...c, harnesses: ['cluade'] }));
  const r = desk(home, 'board', 'check', 'live');
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout, /unclaimed/);
  assert.match(r.stderr, /desk\.config\.json: harnesses must be/);
});

test('init: a misspelled or empty --harness is refused before anything is written', () => {
  for (const h of ['cluade', 'claude,']) {
    const home = tmp();
    const r = desk(home, 'init', '--no-install', '--harness', h);
    assert.equal(r.status, 1, h);
    assert.match(r.stderr, /--harness/);
    assert.equal(existsSync(join(home, 'desk.config.json')), false, 'nothing written');
  }
});

test('desk check fails on a config the desk refuses', () => {
  const { home } = multiDesk();
  editConfig(home, (c) => ({ ...c, harnesses: ['cluade'] }));
  const r = desk(home, 'check');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /harnesses must be/);
});

test('a refused config with a claim on the board: desk status still exits 0', () => {
  const home = legacyDesk();
  editConfig(home, (c) => ({ ...c, harnesses: ['cluade'] }));
  const r = desk(home, 'status');
  assert.equal(r.status, 0, r.stderr);
});

test('desk check on a malformed desk.config.json says "does not parse" and does not echo the file', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'desk.config.json'), '{"repos": SECRETWORD');
  const r = desk(home, 'check');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /does not parse/);
  assert.doesNotMatch(r.stdout + r.stderr, /SECRETWORD/);
});

test('status --watch: a failed board read keeps the last board, so the next good read does not replay it', () => {
  const lines = [{ kind: 'note', slug: 'a', text: 'one' }, { kind: 'note', slug: 'a', text: 'two' }];
  const prev = { board: lines.slice(0, 1) };
  const home = tmp();
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  mkdirSync(join(home, 'board.jsonl')); // a read that fails
  const code = `import { look, carry } from ${JSON.stringify(new URL('../bin/desk.mjs', import.meta.url).href)}; process.stdout.write(JSON.stringify(carry(${JSON.stringify(prev)}, look(1))))`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: home, env: env(home), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const down = JSON.parse(r.stdout);
  assert.deepEqual(down.board, prev.board);
  assert.deepEqual(watchDiff(prev, down).lines, []);
  assert.deepEqual(watchDiff(down, { board: lines }).lines, ['BOARD: ' + JSON.stringify(lines[1])]);
});

test('board summary: a line without from, ts, kind or slug prints no undefined or NaN', () => {
  const home = tmp();
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  writeFileSync(join(home, 'board.jsonl'), '{"text":"bare"}\n{"kind":"claim","slug":"x"}\n');
  const code = `import { summary } from ${JSON.stringify(new URL('../bin/desk.mjs', import.meta.url).href)}; process.stdout.write(summary())`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: home, env: env(home), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /bare/);
  assert.doesNotMatch(r.stdout, /undefined|NaN/);
});
