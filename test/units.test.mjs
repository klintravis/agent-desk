// The checks `desk --self-test` used to run inside the CLI: pure functions of bin/desk.mjs and lib/schema.mjs, fed fixtures.
// Each *Checks() returns one boolean per check; `all` fails the test with the index of every false one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIT } from './helpers.mjs';
import { openClaims, mergeOk, clean, fold, next, nextId, tree, tally, tokenPatterns, WARM_READ, overlaps, statusPaths, statusText, statusData, prState, watchDiff, carry, ownerOpen, decisionOf, decideText, rulingsText } from '../bin/desk.mjs';
import { validate, schema, SCHEMAS } from '../lib/schema.mjs';

const all = (checks) => assert.deepEqual(checks.flatMap((c, i) => (c ? [] : [i])), [], 'failed check indexes');

function boardChecks() {
  const L = (from, kind, slug, ts) => ({ ts, from, kind, slug, text: '' });
  const lines = [L('aaaa', 'claim', 'x', '1'), L('bbbb', 'claim', 'x', '2'), L('aaaa', 'claim', 'gone', '3'), L('aaaa', 'ci', 'y', '4'),
    L('aaaa', 'claim', 'r', '5'), L('aaaa', 'release', 'r', '6')];
  const got = openClaims(lines, (c) => c.slug !== 'gone');
  const V = (text) => ({ ...L('aaaa', 'verdict', 'v', '9'), text });
  const head = 'abcdef1234567890';
  return [
    got.length === 1 && got[0].from === 'bbbb',
    clean('a\nb  c') === 'a b c' && clean('x'.repeat(200), 120).length === 120,
    clean('a\x1b[31m\x07b\u{202e}c\x9bd') === 'a [31m b c d',
    mergeOk([], 'v', head) !== null,
    mergeOk([V('MERGE @abcdef1')], 'v', head) === null,
    mergeOk([V('MERGE @abcdef1'), V('FIXES NEEDED @abcdef1')], 'v', head) !== null, // newest wins
    mergeOk([V('MERGE @1234567')], 'v', head) !== null, // commits after the review
    mergeOk([V('MERGE AFTER FIXES @abcdef1')], 'v', head) !== null,
    mergeOk([V('MERGE @abcdef1 by sonnet/medium')], 'v', head) === null, // the suffix records the review model
    mergeOk([V(`MERGE @${head.padEnd(40, '0')} by opus/high`)], 'v', head.padEnd(40, '0')) === null,
    mergeOk([V('MERGE @1234567 by opus/high')], 'v', head) !== null,
    mergeOk([V('FIXES NEEDED @abcdef1 by opus')], 'v', head) !== null,
  ];
}

function todoChecks() {
  const L = (id, set, ts = '2026-01-01T00:00:00Z') => ({ ts, from: 'aaaa', id, set });
  const t2 = fold([L('T-1', { title: 'a', status: 'open', area: 'repo', prio: 5 }), L('T-2', { title: 'b', status: 'open', area: 'repo', prio: 1, parent: 'T-1' }),
    L('T-3', { title: 'c', status: 'open', area: 'desk', prio: 0 }), L('T-3', { status: 'done', note: 'x' }), L('T-9', { title: 'd', status: 'open', area: 'repo', prio: 9 })]);
  return [
    t2.get('T-3').status === 'done' && t2.get('T-3').notes.length === 1, // later lines win; notes accumulate
    next(t2, 'repo').id === 'T-2', // the open child comes before its parent
    next(fold([L('T-1', { title: 'a', status: 'open', prio: 5 }), L('T-2', { title: 'b', status: 'active', parent: 'T-1' })])) === undefined, // parent waits for an active child
    nextId(t2) === 'T-10',
    next(fold([L('T-1', { title: 'q', status: 'open', area: 'owner', prio: 0 })])) === undefined && next(fold([L('T-1', { title: 'q', status: 'open', area: 'owner' })]), 'owner')?.id === 'T-1',
    tree(t2).split('\n')[0].startsWith('T-1') && tree(t2).split('\n')[1].startsWith('  T-2'),
    next(fold([L('T-1', { title: 'a', status: 'open', area: 'repo' })]), ['kit', 'repo'])?.id === 'T-1',
    // watch items are not work: only `next --area watch` returns them; listed like any area
    next(fold([L('T-1', { title: 'w', status: 'open', area: 'watch', prio: 0 })])) === undefined && next(fold([L('T-1', { title: 'w', status: 'open', area: 'watch' })]), 'watch')?.id === 'T-1',
    tree(fold([L('T-1', { title: 'w', status: 'open', area: 'watch' })])).startsWith('T-1 [open] w · watch'),
    // ideas are not work either, and the plain list hides them
    next(fold([L('T-1', { title: 'i', status: 'open', area: 'idea', prio: 0 })])) === undefined && next(fold([L('T-1', { title: 'i', status: 'open', area: 'idea' })]), 'idea')?.id === 'T-1',
    tree(fold([L('T-1', { title: 'i', status: 'open', area: 'idea' })])) === 'no todos' && tree(fold([L('T-1', { title: 'i', status: 'open', area: 'idea' })]), { area: 'idea' }).startsWith('T-1') && tree(fold([L('T-1', { title: 'i', status: 'open', area: 'idea' })]), { all: true }).startsWith('T-1'),
    // an idea child does not hold back its work parent; inside an idea tree the child still comes first
    next(fold([L('T-1', { title: 'w', status: 'open', area: 'kit' }), L('T-2', { title: 'i', status: 'open', area: 'idea', parent: 'T-1' })]))?.id === 'T-1',
    next(fold([L('T-1', { title: 'i', status: 'open', area: 'idea' }), L('T-2', { title: 'c', status: 'open', area: 'idea', parent: 'T-1' })]), 'idea')?.id === 'T-2',
    // an idea under a work parent lists with --area idea and stays out of the plain list; --all prints each todo once
    tree(fold([L('T-1', { title: 'w', status: 'open', area: 'kit' }), L('T-2', { title: 'i', status: 'open', area: 'idea', parent: 'T-1' })]), { area: 'idea' }).startsWith('T-2'),
    !tree(fold([L('T-1', { title: 'w', status: 'open', area: 'kit' }), L('T-2', { title: 'i', status: 'open', area: 'idea', parent: 'T-1' })])).includes('T-2'),
    tree(fold([L('T-1', { title: 'w', status: 'open', area: 'kit' }), L('T-2', { title: 'i', status: 'open', area: 'idea', parent: 'T-1' })]), { all: true }).split('\n').length === 2,
    // work under an idea parent still lists, as todo next hands it out
    tree(fold([L('T-1', { title: 'i', status: 'open', area: 'idea' }), L('T-2', { title: 'w', status: 'open', area: 'kit', parent: 'T-1' })])).startsWith('T-2'),
    // a line without v (written before v: 1) folds as before
    fold([{ ts: '2026-01-01T00:00:00Z', from: 'aaaa', id: 'T-1', set: { title: 'a', status: 'open' } }, { v: 1, ts: '2026-01-02T00:00:00Z', from: 'aaaa', id: 'T-1', set: { status: 'done' } }]).get('T-1').status === 'done',
  ];
}

function tokensChecks() {
  const line = (rid, i, r, w, o) => JSON.stringify({ type: 'assistant', requestId: rid, message: { model: 'claude-x', usage: { input_tokens: i, cache_read_input_tokens: r, cache_creation_input_tokens: w, output_tokens: o } } });
  const syn = (uuid) => JSON.stringify({ type: 'assistant', uuid, message: { id: uuid, model: '<synthetic>', usage: { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0 } } });
  const plain = (uuid) => JSON.stringify({ type: 'assistant', uuid, message: { model: 'claude-x', usage: { input_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 } } });
  const t = tally([line('a', 1, 100, 10, 5), line('a', 1, 100, 10, 5), line('b', 2, 200, 0, 7), 'garbage'].join('\n'));
  const title = (...lines) => tally(lines.map((l) => JSON.stringify(l)).join('\n')).title;
  const ai = (aiTitle) => ({ type: 'ai-title', aiTitle }), custom = { type: 'custom-title', customTitle: 'Mine' };
  const compacted = tally([line('a', 1, 100, 10, 5), line('b', 2, 200, 0, 7), line('a', 0, 0, 0, 0)].join('\n')); // the compaction's copy of call a
  const sub = (sinceSpawn, firstRead, depth = 1) => ({ type: 'x', calls: 2, input: 10, write: 0, read: 100, firstFresh: 5, firstRead, sinceSpawn, depth });
  const p = tokenPatterns([{ calls: 1, input: 99, write: 0, read: 0, firstFresh: 99, firstRead: 0 }, sub(null, 0), sub(299, WARM_READ), sub(300, WARM_READ - 1), sub(3600, 0, 2)]);
  return [t.calls === 2 && t.peak === 202 && t.out === 12 && t.write === 10,
    compacted.calls === 2 && compacted.read === 300 && compacted.out === 12 && compacted.firstFresh === 11 && compacted.firstRead === 100,
    p.runs === 4 && p.nested === 1 && p.firstShare === 50 && p.readsPerCall === 50,
    p.warm['<5m'].join() === '1,1' && p.warm['5-60m'].join() === '1,0' && p.warm['>60m'].join() === '1,0' && p.warm.first.join() === '1,0',
    tally([line('a', 1, 100, 10, 5), syn('s1'), syn('s2')].join('\n')).calls === 1, // synthetic lines are not calls
    tally([plain('u1'), plain('u2'), plain('u1')].join('\n')).calls === 2, // no requestId, not synthetic: uuid
    t.title === '', title(ai('first'), ai('last\n line')) === 'last line', title(custom, ai('later')) === 'Mine'];
}

function statusChecks() {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const L = (id, set) => ({ ts: '2026-11-01T00:00:00Z', from: 'aaaa', id, set });
  const t = fold([L('T-1', { title: 'act', status: 'active', area: 'repo', owner: 'bbbb', state: 'built', next: 'review' }), L('T-2', { title: 'ask', status: 'open', area: 'owner' }),
    L('T-3', { title: 'ruled', status: 'done', area: 'owner' })]);
  const board = [{ ts: '2026-11-01T11:00:00Z', from: 'bbbb', kind: 'verdict', slug: 'x', text: 'MERGE @abcdef1' }];
  const rows = [{ session: 'bbbb', agent: 'main', last: '2026-11-01T11:55:00Z', calls: 3, input: 1, write: 2, read: 10, out: 4 },
    { session: 'bbbb', agent: 'agent-desk:reviewer/high: x', type: 'reviewer/high', about: 'Review x', last: '2026-11-01T11:58:00Z', calls: 1, input: 0, write: 0, read: 0, out: 0 },
    { session: 'cccc', agent: 'main', last: '2026-11-01T09:00:00Z', calls: 1, input: 0, write: 0, read: 0, out: 0 }];
  const runs = [{ headBranch: 'agent/x', headSha: 'abcdef1234', status: 'completed', conclusion: 'success' }];
  const s = statusText({ t, board, rows, runs, heads: new Map([['x', 'abcdef1234'], ['y', '1111111']]), overlaps: ['x + y: a.ts'], now });
  const down = statusText({ t: new Map(), board: [], rows: null, runs: null, heads: new Map([['y', '1']]), overlaps: null, now });
  return [
    /Owner decisions waiting\n- T-2 ask\n/.test(s) && !s.includes('ruled'),
    /- T-1 \[active bbbb\] act.*\n {4}state: built\n {4}next: review/.test(s),
    s.includes('- bbbb\n    reviewer/high: Review x\n') && !s.includes('- cccc'),
    // a session's title and the worktrees it holds (several joined); a missing title falls back to the id
    ((x) => x.includes('- Fix the pane (bbbb, wt:p,q)\n') && x.includes('- dddd (wt:r)\n'))(statusText({ t: new Map(), runs: [], heads: new Map(), overlaps: [], now, exists: () => true,
      board: [{ from: 'bbbb', kind: 'claim', slug: 'p' }, { from: 'bbbb', kind: 'claim', slug: 'q' }, { from: 'dddd', kind: 'claim', slug: 'r' }],
      rows: [{ session: 'bbbb', agent: 'main', title: 'Fix the pane', first: '2026-11-01T11:00:00Z', last: '2026-11-01T11:55:00Z', calls: 0, input: 0, write: 0, read: 0, out: 0 },
        { session: 'dddd', agent: 'main', last: '2026-11-01T11:55:00Z', calls: 0, input: 0, write: 0, read: 0, out: 0 }] })),
    // a claim with no ts prints an age of ?, never NaN
    !/NaN/.test(statusText({ t: new Map(), runs: [], heads: new Map(), overlaps: [], now, exists: () => true, rows: [],
      board: [{ from: 'bbbb', kind: 'claim', slug: 'p' }] })),
    s.includes('- x @abcdef1: CI abcdef1 success; verdict: MERGE @abcdef1 [ready]') && s.includes('- y @1111111: no CI run'),
    // the default branch's CI: a run of its sha, not of another branch or an older commit
    statusData({ t: new Map(), board: [], rows: [], heads: new Map(), overlaps: [], now, roots: [{ id: 'a', kind: 'git', gh: 'o/a', path: '/a', defaultBranch: 'main', sha: 'abcdef1234' }],
      runs: [{ headBranch: 'main', headSha: 'abcdef1234', status: 'completed', conclusion: 'failure', repo: 'a' }, { headBranch: 'main', headSha: '0000000', status: 'completed', conclusion: 'success', repo: 'a' }] }).roots[0].ci === 'failure',
    s.includes('- x + y: a.ts') && s.includes('5 calls, fresh 3, cached 10, out 4'),
    down.includes('CI unavailable') && down.includes('## Running sessions\n- unavailable') && down.includes('- unavailable\n## Tokens'),
    // a branch prefix from the config; a run of another repo on the same branch name is not this one's CI
    statusText({ t: new Map(), board: [], rows: [], heads: new Map([['z', '2222222'], ['w', '3333333']]), overlaps: [], now,
      runs: [{ headBranch: 'wk/z', headSha: '2222222', status: 'completed', conclusion: 'failure', repo: 'b' }, { headBranch: 'wk/w', headSha: '3333333', status: 'completed', conclusion: 'success', repo: 'a' }],
      branches: new Map([['z', { branch: 'wk/z', repo: 'a' }], ['w', { branch: 'wk/w', repo: 'a' }]]) })
      .includes('- w @3333333: CI 3333333 success; verdict: none [needs review]\n- z @2222222: no CI run'),
    // a repo without gh: CI "-"; roots list git repos and plain folders
    // ... and the default branch's sha on each git root line (`@?` when it cannot be read)
    ((x) => x.includes('- q @4444444: CI -;') && x.includes('## Roots\n- a: git, no CI /a, main @abcdef1; no check command, wt finish checks nothing\n- b: git, CI o/b /b, develop @?: CI none\n- n: folder /n\n## Open branches'))(statusText({ t: new Map(), board: [], rows: [], heads: new Map([['q', '4444444']]), overlaps: [], now, runs: [],
      branches: new Map([['q', { branch: 'agent/q', repo: 'a', gh: '' }]]), roots: [{ id: 'a', kind: 'git', gh: '', path: '/a', defaultBranch: 'main', sha: 'abcdef1234', check: '' }, { id: 'b', kind: 'git', gh: 'o/b', path: '/b', defaultBranch: 'develop', sha: '' }, { id: 'n', kind: 'folder', path: '/n' }] })),
    // behind the default branch: shown only when N > 0
    ((x) => x.includes('- x @abcdef1: no CI run; verdict: none [rebase]; behind develop by 3, rebase\n') && x.includes('- y @1111111: no CI run; verdict: none [no CI yet]\n'))(statusText({ t: new Map(), board: [], rows: [], runs: [], heads: new Map([['x', 'abcdef1'], ['y', '1111111']]), overlaps: [], now,
      behind: new Map([['x', { n: 3, base: 'develop' }], ['y', { n: 0, base: 'develop' }]]) })),
    // PRs: no gh (null) = no section; a PR of a desk branch with its review state; another repo's same branch does not match
    !s.includes('## Pull requests'),
    statusText({ t: new Map(), board: [], rows: [], runs: [], heads: new Map([['x', 'abcdef1'], ['y', '1111111']]), overlaps: [], now,
      prs: [prState({ number: 7, headRefName: 'agent/x', reviewDecision: 'CHANGES_REQUESTED', comments: { totalCount: 2, nodes: [{ createdAt: '2026-11-01T09:00:00Z' }, { createdAt: '2026-11-01T11:00:00Z' }] },
        reviews: { nodes: [{ submittedAt: '2026-11-01T11:00:00Z' }] }, reviewThreads: { nodes: [{ isResolved: false, comments: { totalCount: 3, nodes: [{ createdAt: '2026-11-01T08:00:00Z' }] } }, { isResolved: true, comments: { totalCount: 1, nodes: [] } }] },
        commits: { nodes: [{ commit: { committedDate: '2026-11-01T10:00:00Z' } }] } }), { ...prState({ number: 9, headRefName: 'agent/y' }), repo: 'other' }],
      branches: new Map([['x', { branch: 'agent/x', repo: 'a' }], ['y', { branch: 'agent/y', repo: 'a' }]]) })
      .includes('## Pull requests\n- x #7: review changes requested, 6 comment(s), 1 unresolved, 2 new since the head commit\n## Overlaps'),
  ];
}

function watchChecks() {
  const run = (sha, status, conclusion = '') => ({ headBranch: 'agent/x', headSha: sha, status, conclusion });
  const row = (agent, calls, peak, file = agent + '.jsonl') => ({ session: 's', agent, model: 'm', calls, peak, file });
  const prev = { board: [{ kind: 'claim' }], runs: [run('aaaaaaa1', 'in_progress')], rows: [row('main', 1, 1e5), row('r', 0, 0)], overlaps: ['a + b: f'] };
  const cur = { board: [{ kind: 'claim' }, { kind: 'note', text: 'a + c: g (second to merge rebases)' }], runs: [run('aaaaaaa1', 'completed', 'success')],
    rows: [row('main', 9, 3e5), row('r', 2, 1)], overlaps: ['a + b: f', 'a + c: g', 'b + c: h'] };
  const d = watchDiff(prev, cur);
  return [
    d.lines[0].startsWith('BOARD: {"kind":"note"') && d.lines.length === 6,
    d.lines.includes('CI: agent/x aaaaaaa completed success'),
    d.lines.includes('CTX>250k: s main peak 300k after 9 calls') && d.lines.includes('AGENT+: s r (m)'),
    d.lines.includes('OVERLAP: a + c: g') && JSON.stringify(d.post) === '[["b","b + c: h (second to merge rebases)"],["ctx","[main.jsonl] s main over 250k (announced)"]]',
    // CTX>250k prints once ever per run: a run with a matching ctx note on the board stays quiet
    !watchDiff(prev, { ...cur, board: [...cur.board, { kind: 'note', slug: 'ctx', text: '[main.jsonl] s main over 250k (announced)' }] }).lines.some((l) => l.startsWith('CTX>250k')),
    // two runs with one label (a relaunch): each announces; a run announces once; an old-format note neither crashes nor silences
    ((a) => a.lines.filter((l) => l.startsWith('CTX>250k')).length === 2 && a.post.length === 2 && a.post[0][1] !== a.post[1][1] && !a.post.some(([, t]) => t.includes('CTX>250k:') || t.includes('/') || t.includes('\\')))(
      watchDiff({ board: [], rows: [row('r', 1, 1e5, 'a.jsonl'), row('r', 1, 1e5, 'b.jsonl')] }, { board: [], rows: [row('r', 9, 3e5, 'a.jsonl'), row('r', 9, 3e5, 'b.jsonl')] })),
    watchDiff({ board: [], rows: [row('r', 1, 1e5, 'a.jsonl')] }, { board: [{ kind: 'note', slug: 'ctx', text: '[a.jsonl] s r over 250k (announced)' }, { kind: 'note', slug: 'ctx' }, { kind: 'note', slug: 'ctx', text: 's r over 250k (announced)' }], rows: [row('r', 9, 3e5, 'a.jsonl'), row('r', 9, 3e5, 'b.jsonl')] })
      .lines.filter((l) => l.startsWith('CTX>250k')).length === 0,
    watchDiff({ board: [], rows: [row('r', 1, 1e5, 'b.jsonl')] }, { board: [{ kind: 'note', slug: 'ctx', text: '[a.jsonl] s r over 250k (announced)' }, { kind: 'note', slug: 'ctx' }, { kind: 'note', slug: 'ctx', text: 's r over 250k (announced)' }], rows: [row('r', 9, 3e5, 'b.jsonl')] })
      .lines.filter((l) => l.startsWith('CTX>250k')).length === 1,
    // a long real label: the posted note survives post()'s 120-char cut, so a re-crossing stays quiet
    ((lab, f) => {
      const lo = [row(lab, 1, 1e5, f)], hi = [row(lab, 9, 3e5, f)];
      const text = clean(watchDiff({ board: [], rows: lo }, { board: [], rows: hi }).post[0][1], 120);
      return !watchDiff({ board: [], rows: lo }, { board: [{ kind: 'note', slug: 'ctx', text }], rows: hi }).lines.some((l) => l.startsWith('CTX>250k'));
    })('agent-desk:implementer/low: ' + 'x'.repeat(60), 'agent-0123456789abcdef0.jsonl'),
    watchDiff({ ...prev, runs: null, rows: null }, { ...cur, runs: null }).lines.length === 3,
    // gh fails once between two good looks: the completed run still prints on recovery
    watchDiff(carry(prev, { ...prev, runs: null, rows: null }), cur).lines.includes('CI: agent/x aaaaaaa completed success'),
    // OWNER+: new ones print and post once; one already announced on the board (a restart) stays quiet
    JSON.stringify(watchDiff({ board: [], owner: ['T-1 a'] }, { board: [{ kind: 'note', slug: 'owner', text: 'T-2 b' }], owner: ['T-1 a', 'T-2 b', 'T-3 c'] }))
      === '{"lines":["BOARD: {\\"kind\\":\\"note\\",\\"slug\\":\\"owner\\",\\"text\\":\\"T-2 b\\"}","OWNER+: T-3 c"],"post":[["owner","T-3 c"]]}',
    // PR: a new decision or new comments since the last look; an unchanged PR stays quiet
    JSON.stringify(watchDiff({ board: [], prs: [{ repo: 'a', number: 7, headRefName: 'agent/x', decision: 'REVIEW_REQUIRED', comments: 1 }, { repo: 'a', number: 8, decision: 'NONE', comments: 0 }] },
      { board: [], prs: [{ repo: 'a', number: 7, headRefName: 'agent/x', decision: 'CHANGES_REQUESTED', comments: 3 }, { repo: 'a', number: 8, decision: 'NONE', comments: 0 }] }).lines)
      === '["PR: agent/x #7 review changes_requested, +2 comment(s)"]',
    ownerOpen(fold([{ ts: '1', id: 'T-2', set: { title: 'q', status: 'open', area: 'owner' } }, { ts: '1', id: 'T-3', set: { title: 'r', status: 'done', area: 'owner' } },
      { ts: '1', id: 'T-4', set: { title: 'w', status: 'open', area: 'desk' } }])).join() === 'T-2 q',
  ];
}

function decideChecks() {
  const L = (id, set) => ({ ts: '1', from: 'aaaa', id, set });
  const t = fold([L('T-1', { title: 'pick', status: 'open', area: 'owner', why: 'Options: (a) keep; (b) drop' }), L('T-2', { title: 'later', status: 'open', area: 'owner', prio: 60 }),
    L('T-3', { title: 'gone', status: 'done', area: 'owner' })]);
  const recs = [{ text: 'old one' }, { date: '2026-11-01', todo: 'T-4', title: 'pick', text: 'keep' }];
  const old = (why) => decisionOf({ id: 'T-9', title: 'q', why }).options;
  // T-151 as it was written: a `;` split whose whole first part used to become the recorded ruling.
  const t151 = old('Refuse (recommended): a hidden push cannot slip through, at the cost of rare false refusals, also for allowed pushes and from any directory; Allow as before: no false refusals, as the 2026-11-02 merge-policy design said, but an unparseable line can hide a push from this guard');
  const both = [{ label: 'keep', why: 'it works' }, { label: 'drop' }];
  return [
    decideText(t).startsWith('T-1 (1 of 2): pick\n  1. Recommended: (a) keep\n  2. Or: (b) drop\nAnswer: /decide T-1 --pick <n> ') && decideText(t).includes('desk decide T-1 --pick <n>, counted from 1') && decideText(t).includes(`desk decide T-1 '<ruling>'`) && !decideText(t).includes('"'),
    old('(recommended); b').map((o) => o.label).join() === 'b', // an empty label would be a --pick that records nothing
    t151.map((o) => o.label).join() === 'Refuse,Allow as before' && t151[0].why.startsWith('a hidden push') && t151[1].why.endsWith('from this guard'),
    old('keep it (recommended); drop it').map((o) => o.label).join() === 'keep it,drop it' && !old('a; b')[0].why,
    old('a; b (Recommended)').map((o) => o.label).join() === 'b,a', // the marker outranks the order
    old('one: x; two').map((o) => o.label).join() === 'one: x,two' && !old('one: x; two')[0].why, // not every part has a label: nothing is split
    old('same: x; same: y').map((o) => o.label).join() === 'same: x,same: y', // two equal labels could not tell the options apart
    old(`${'x'.repeat(61)}: x; b: y`)[0].label.length > 61, // a label that long is prose
    old('only: one part')[0].label === 'only: one part' && old('')?.length === 0,
    decisionOf({ id: 'T-9', title: 'q', why: 'because; really', options: both }).context === 'because; really' && decisionOf({ id: 'T-9', title: 'q', why: 'because; really', options: both }).options.length === 2,
    decideText(fold([L('T-1', { title: 'pick', status: 'open', area: 'owner', why: 'context here', options: both })])).startsWith('T-1 (1 of 1): pick\n  context here\n  1. Recommended: keep\n    it works\n  2. Or: drop\nAnswer: '),
    decideText(fold([L('T-2', { title: 'later', status: 'blocked', area: 'owner' })])).includes('(no options given)') && decideText(new Map()) === 'No owner decisions waiting.\n', // blocked still waits: the band counts it
    rulingsText(recs) === '# Rulings recorded\n- undated: old one\n- 2026-11-01 (T-4): pick: keep\n',
    rulingsText(recs, 1) === '# Rulings recorded\n- 2026-11-01 (T-4): pick: keep\n', // the last n, oldest first
    rulingsText([]) === 'No rulings recorded.\n',
  ];
}

// lib/schema.mjs schemaTest: walks every shipped schema (an unsupported keyword throws) and checks the validator on known cases.
function schemaChecks(kit = KIT) {
  const s = Object.fromEntries([...Object.values(SCHEMAS), 'desk-status', 'user-settings'].map((n) => [n, schema(n, kit)])); // output and a user's file, not desk files
  const walk = (x) => { validate(x, undefined); for (const sub of [...Object.values(x.properties ?? {}), x.items, x.additionalProperties]) if (sub !== null && typeof sub === 'object' && !Array.isArray(sub)) walk(sub); };
  const ts = '2026-11-01T00:00:00.000Z';
  return [
    Object.values(s).every((x) => (walk(x), true)),
    (() => { try { validate({ minimum: 1 }, 1); return false; } catch { return true; } })(), // unknown keyword
    validate(s.todo, { v: 1, ts, from: 'aaaa', id: 'T-1', set: { title: 'a', status: 'open', area: 'desk', size: 'small', prio: 3, any: 'x' } }).length === 0,
    validate(s.todo, { ts, from: 'aaaa', id: 'T-1', set: { status: 'done', note: 'x' } }).length === 0, // an old line without v
    validate(s.todo, { v: 1, ts, from: 'aaaa', id: 'T1', set: { status: 'later', prio: 1.5 } }).join() === '/id: must match ^T-\\d+$,/set/status: must be one of open, active, blocked, done, dropped,/set/prio: must be integer or null',
    validate(s.board, { v: 1, ts, from: 'aaaa', kind: 'claim', slug: 'a-b', text: '', repo: 'kit' }).length === 0,
    validate(s.board, { ts, from: 'aaaa', kind: 'claim', slug: 'A b', extra: 1 }).join() === '/slug: must match ^[a-z0-9][a-z0-9-]*$,/: unknown field extra',
    validate(s.decisions, { v: 1, ts, from: 'aaaa', date: '2026-11-01', todo: 'T-40', title: 't', text: 'drop it' }).length === 0,
    validate(s.decisions, { v: 2, ts, from: 'aaaa', text: '' }).join() === '/v: must be 1,/text: must have at least 1 characters',
    validate(s['desk-config'], { repos: [{ id: 'kit', path: '../kit', kind: 'git' }], harnesses: ['claude'], custom: 1 }).length === 0,
    validate(s['desk-config'], { repos: [{ id: 'Kit' }] }).join() === '/repos/0: missing path,/repos/0/id: must match ^[a-z0-9][a-z0-9-]*$',
    validate(s.todo, []).join() === '/: must be object',
    validate(s['desk-status'], { v: 2, at: ts, decisions: [], active: [], todos: [], claims: [], sessions: [{ session: 'abcd1234', title: 't', slug: 'x,y', agents: [{ type: 'reviewer/high', about: '' }] }, { session: 'ef', agents: [] }], roots: [], branches: [], prs: null, overlaps: null, tokens: null, user: null, text: '' }).length === 0,
    validate(s['desk-status'], { v: 2, at: ts, decisions: [], active: [], todos: [], claims: [], sessions: null, roots: [], branches: [], prs: null, overlaps: null, tokens: null, user: null, text: '' }).length === 0,
    validate(s['desk-status'], { v: 2, at: ts, decisions: [], active: [], todos: [], claims: [], sessions: null, roots: [], branches: [], prs: null, overlaps: null, tokens: null, user: { file: 'f', below: [{ task: 'review', model: 'sonnet', effort: 'medium', shared: { model: 'opus', effort: 'high' } }], raised: [{ task: 'docs', model: 'opus', effort: 'low', replaced: { model: 'sonnet' } }] }, text: '' }).length === 0,
    validate(s['desk-status'], { v: 2, at: ts, decisions: [{ id: 'T-1' }], active: [], todos: [], claims: [], sessions: [], roots: [], branches: [], prs: [], overlaps: [], tokens: null, user: null, text: '' }).join() === '/decisions/0: missing title',
    validate(s['user-settings'], { $schema: 'x', tasks: { review: { model: 'fable', effort: 'max' } }, cache: { promptCacheTtl: '5m', idleCompaction: false } }).length === 0,
    validate(s['user-settings'], { apiKey: 'x' }).join() === '/: unknown field apiKey',
    validate(s['user-settings'], { tasks: { review: { model: 'claude-opus-4-5' } } }).length === 1,
    validate(s['desk-config'], { floor: { review: { model: 'opus', effort: 'high' } }, tasks: { memo: { model: 'fable' } } }).length === 0,
    validate(s['desk-config'], { floor: { review: { model: 'fable' } } }).length === 1,
  ];
}

test('board checks', () => all(boardChecks()));
test('todo checks', () => all(todoChecks()));
test('tokens checks', () => all(tokensChecks()));
test('status checks', () => all(statusChecks()));
test('status --watch checks', () => all(watchChecks()));
test('decide checks', () => all(decideChecks()));
test('schema checks', () => all(schemaChecks()));
test('overlaps: files changed by two worktrees', () => {
  const got = overlaps(new Map([['a', new Set(['x.ts', 'y.ts'])], ['b', new Set(['y.ts'])], ['c', new Set(['z.ts'])]]));
  assert.deepEqual(got, ['a + b: y.ts']);
});
test('statusPaths: untracked files, names with spaces or non-ASCII unquoted, a rename keeps its new name only', () => {
  assert.deepEqual(statusPaths('?? dir/a b.txt\0 M café.ts\0R  new.ts\0old.ts\0?? z.ts\0'), ['dir/a b.txt', 'café.ts', 'new.ts', 'z.ts']);
});
test('status --watch: a re-run of the same commit that ends differently prints a CI: line', () => {
  const run = (conclusion) => ({ headBranch: 'agent/x', headSha: 'aaaaaaa1', status: 'completed', conclusion });
  assert.deepEqual(watchDiff({ board: [], runs: [run('failure')] }, { board: [], runs: [run('success')] }).lines, ['CI: agent/x aaaaaaa completed success']);
  assert.deepEqual(watchDiff({ board: [], runs: [run('success')] }, { board: [], runs: [run('success')] }).lines, []);
});
test('fold skips a non-string id; tally skips a null line', () => {
  assert.equal(fold([{ id: 7, set: { title: 'x' } }, { id: 'T-1', set: { note: 'n' } }]).size, 1);
  assert.doesNotThrow(() => tally('null\n{"timestamp":"t"}'));
});

// From v0.7.0's in-CLI self-tests (merged from the public release): the merge gate's overrides, acceptance claims,
// reserved todo keys and the `not pushed` state word.
test('v0.7.0: merge gate overrides, acceptance claims, reserved keys, not pushed', async () => {
  const { needsClaim, branchWord } = await import('../bin/desk.mjs');
  const V = (text) => ({ ts: '9', from: 'aaaa', kind: 'verdict', slug: 'v', text });
  const head = 'abcdef1234567890';
  const L = (id, set, ts = '2026-01-01T00:00:00Z') => ({ ts, from: 'aaaa', id, set });
  all([
    mergeOk([V('FIXES NEEDED @abcdef1 validation: 1 not verified'), V('MERGE @abcdef1 by opus/high')], 'v', head) !== null, // a blocker on the head outlives a later MERGE
    mergeOk([V('FIXES NEEDED @abcdef1 validation'), V('MERGE @abcdef1 overrides: rerun verified')], 'v', head) === null, // until an override
    mergeOk([V('FIXES NEEDED @1234567'), V('MERGE @abcdef1')], 'v', head) === null, // a blocker on an older head does not count
    mergeOk([V('FIXES NEEDED @abcdef1'), V('MERGE @abcdef1 overrides: x'), V('FIXES NEEDED @abcdef1 validation')], 'v', head) !== null, // a blocker after an override blocks again
    mergeOk([V('FIXES NEEDED @abcdef1'), V('MERGE @1234567 overrides: x'), V('MERGE @abcdef1')], 'v', head) !== null, // an override for another head clears nothing
    mergeOk([V('FIXES NEEDED @abcdef1'), V('MERGE @abcdef1 overrides: x'), V('MERGE @abcdef1 by sonnet/medium')], 'v', head) === null, // a late plain MERGE does not re-block
    mergeOk([V('DO NOT MERGE @abcdef1'), V('MERGE @abcdef1 overrides: x')], 'v', head) !== null, // DO NOT MERGE needs a new commit
    needsClaim(fold([L('T-1', { title: 'a', kind: 'fix' }), L('T-1', { note: 'we will accept: later' })]).get('T-1')),
    !needsClaim(fold([L('T-1', { title: 'a', kind: 'fix' }), L('T-1', { note: 'accept: x | y | z' })]).get('T-1')),
    !needsClaim(fold([L('T-1', { title: 'a' })]).get('T-1')) && !needsClaim(fold([L('T-1', { title: 'a', kind: 'docs' })]).get('T-1')), // untyped and docs todos start as before
    ((x) => x.id === 'T-1' && x.created !== 'bad' && x.notes.includes('see PR'))(fold([L('T-1', { title: 'a', notes: 'see PR', id: 'T-9', created: 'bad' })]).get('T-1')), // reserved keys never come from a line; old notes text is kept
    branchWord({ ci: 'success', board: [V('MERGE @abcdef1')], slug: 'v', head, pushed: false }) === 'not pushed',
    branchWord({ ci: 'success', board: [V('MERGE @abcdef1')], slug: 'v', head }) === 'ready',
  ]);
});
