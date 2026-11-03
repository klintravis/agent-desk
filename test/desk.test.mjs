import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, desk, multiDesk, env, BIN, KIT } from './helpers.mjs';
import { validate, schema, deskFileWarnings } from '../lib/schema.mjs';
import { statusData } from '../bin/desk.mjs';

test('desk --self-test (board, todo, tokens, status, watch, decide, schema)', () => {
  const r = desk(tmp(), '--self-test');
  assert.equal(r.status, 0, r.stdout + r.stderr);
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
    ...(fresh === null ? [] : [JSON.stringify({ type: 'assistant', cwd: s.cwd ?? home, requestId: 'r', timestamp: new Date().toISOString(), message: { model: 'claude-x', usage: { input_tokens: fresh, cache_read_input_tokens: s.read ?? 0, output_tokens: 1 } } })]),
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

test('the review verdict: agents, the brief and a stream record the review model; committed todos do not', () => {
  const read = (...p) => readFileSync(join(KIT, ...p), 'utf8');
  for (const f of ['reviewer', 'verifier']) assert.match(read('agents', `${f}.md`), /@<sha> by <model>\/<effort>"[\s\S]*`by <model>`\s+alone/);
  assert.match(read('skills', 'orchestrate', 'SKILL.md'), /`reviewer` or\s+`verifier` brief also states the model and effort[\s\S]*`by <model>\/<effort>`/);
  assert.match(read('lib', 'wt.mjs'), /`reviewer` and `verifier` brief states the model and effort[\s\S]{0,80}`<VERDICT> @<sha> by <model>\/<effort>`/);
  assert.match(read('skills', 'handoff', 'SKILL.md'), /Quote a verdict in `--state`\s+as `<VERDICT> @<sha>`, without its `by <model>\/<effort>` part/);
});

test('the skills: orchestrate names the command and its fallback; kickoff and handoff record the shared value', () => {
  const read = (...p) => readFileSync(join(KIT, ...p), 'utf8');
  const skill = read('skills', 'orchestrate', 'SKILL.md');
  assert.match(skill, /`desk settings --json`/);
  assert.match(skill, /If the command fails, the table below is the fallback[\s\S]*`floor`/);
  assert.doesNotMatch(skill, /the strongest model/);
  for (const s of ['kickoff', 'handoff']) assert.match(read('skills', s, 'SKILL.md'), /`shared`/);
});
