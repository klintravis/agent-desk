// The per-repo merge policy: `wt merge` under `direct` and `review`, the close after a server merge, --into, the PR body.
// Temp dirs only; `gh` is the preload in gh-stub.mjs, and the bare origin holds refs/pull/<n>/head for real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { multiDesk, desk, git, commit, env, tmp, BIN, ok, board, setRepo } from './helpers.mjs';
import { prBody } from '../lib/wt.mjs';
import { loadConfig } from '../lib/config.mjs';
import { mergeChecks, statusData, statusText } from '../bin/desk.mjs';
import { validate, schema } from '../lib/schema.mjs';
import { hasSecret } from '../hooks/secretpatterns.mjs';
import { prText } from '../hooks/prtext.mjs';

const STUB = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'gh-stub.mjs')).href;
const fails = (r, re) => { assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`); assert.match(r.stderr, re); };
// Fixture key built at run time, so no real-looking key sits in this source.
const KEY = `gh${'p_'}${'x'.repeat(30)}`;

// The CLI with `gh` stubbed and this answer file.
function stubbed(home, stubFile, answers, ...args) {
  writeFileSync(stubFile, JSON.stringify(answers));
  return spawnSync(process.execPath, [BIN, ...args], { cwd: home, env: { ...env(home), GH_STUB: stubFile, NODE_OPTIONS: `--import=${STUB}` }, encoding: 'utf8' });
}

// A desk whose repo a has a worktree `demo` with one pushed commit; `fields` is its repo config.
function fixture(fields, { verdict = true } = {}) {
  const { root, home } = multiDesk();
  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a'));
  const wt = join(root, 'worktrees', 'a-demo'), sha = commit(wt, 'one.txt', 'one\n');
  git(wt, 'push', '-q', '-u', 'origin', 'agent/demo');
  if (verdict) ok(desk(home, 'board', 'post', 'verdict', 'demo', `MERGE @${sha}`));
  // Set last: plain desk() has no stub, so no repo holds a gh value while it runs.
  setRepo(home, 'a', fields);
  const stubFile = join(tmp(), 'gh.json');
  const findings = join(tmp(), 'findings.md');
  writeFileSync(findings, 'no findings\n');
  const f = {
    root, home, wt, sha, findings, main: join(root, 'a'), bare: join(root, 'a.git'),
    run: (answers, ...args) => stubbed(home, stubFile, answers, ...args),
    calls: () => (existsSync(`${stubFile}.log`) ? readFileSync(`${stubFile}.log`, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []),
    prCalls: () => f.calls().filter((c) => c.args[2] === 'pr' && c.args[3] !== 'list'),
    mainHeads: () => [git(f.main, 'rev-parse', 'main'), git(f.bare, 'rev-parse', 'refs/heads/main')],
  };
  f.before = f.mainHeads();
  return f;
}

const REVIEW = { merge: 'review', gh: 'o/r' };
const pr = (state, headRefOid, number = 7) => ({ number, state, headRefOid, url: `https://github.example/o/r/pull/${number}` });
const untouched = (f) => {
  assert.deepEqual(f.mainHeads(), f.before, 'the default branch, local and on origin, did not move');
  assert.ok(existsSync(join(f.wt, '.git')), 'the worktree stays');
  assert.equal(git(f.main, 'branch', '--list', 'agent/demo').replace('+', '').trim(), 'agent/demo', 'the branch stays');
};
const closed = (f, text) => {
  assert.ok(!existsSync(join(f.wt, '.git')), 'the worktree is gone');
  assert.equal(git(f.main, 'branch', '--list', 'agent/demo'), '', 'the local branch is gone');
  assert.deepEqual(board(f.home).filter((p) => p.kind === 'merged').map((p) => p.text), [text]);
  assert.equal(board(f.home).at(-1).kind, 'release');
  assert.equal(f.prCalls().length, 0, 'closing opens no PR');
  assert.equal(git(f.main, 'rev-parse', 'main'), f.before[0], 'the main checkout was not fast-forwarded');
};
// A commit on the server's default branch, as a merge button makes it.
const serverCommit = (bare, ...parents) => {
  const c = git(bare, 'commit-tree', 'refs/heads/main^{tree}', ...parents.flatMap((p) => ['-p', p]), '-m', 'server');
  return c;
};
const serverMain = (bare, sha) => git(bare, 'update-ref', 'refs/heads/main', sha);

// 6.1, the wt merge part: direct stays today's flow and never asks about a PR.
for (const [name, fields] of [['merge absent', { gh: 'o/r' }], ['merge: "direct"', { gh: 'o/r', merge: 'direct' }]]) {
  test(`direct, ${name}: fast-forward and push, no pr call`, () => {
    const f = fixture(fields);
    ok(f.run({}, 'wt', 'merge', 'demo'));
    assert.deepEqual(f.calls().map((c) => c.args.slice(2, 4).join(' ')), ['run list']);
    assert.deepEqual(f.mainHeads(), [f.sha, f.sha]);
    assert.equal(board(f.home).filter((p) => p.kind === 'merged')[0].text, `main=${f.sha.slice(0, 7)}; open worktrees rebase`);
    assert.ok(!existsSync(join(f.wt, '.git')));
  });
}

test('direct: --findings is ignored and changes nothing', () => {
  for (const fields of [{ gh: 'o/r' }, { gh: 'o/r', merge: 'direct' }]) {
    const f = fixture(fields);
    ok(f.run({}, 'wt', 'merge', 'demo', '--findings', f.findings));
    assert.deepEqual(f.mainHeads(), [f.sha, f.sha]);
    assert.equal(f.prCalls().length, 0);
  }
});

// 6.2
test('config: merge defaults to direct; a bad value, review on a folder and review with no prefix throw', () => {
  const deskWith = (repo) => { const d = tmp(); writeFileSync(join(d, 'desk.config.json'), JSON.stringify({ repos: [{ id: 'x', path: '.', ...repo }] })); return d; };
  assert.equal(loadConfig(deskWith({})).repos[0].merge, 'direct');
  assert.equal(loadConfig(deskWith({ merge: 'review' })).repos[0].merge, 'review');
  for (const merge of ['Review', '', null, true]) assert.throws(() => loadConfig(deskWith({ merge })), /\(x\) merge must be direct or review/);
  assert.throws(() => loadConfig(deskWith({ merge: 'review', kind: 'folder' })), /\(x\) merge "review" needs a git repo/);
  assert.throws(() => loadConfig(deskWith({ merge: 'review', branchPrefix: '' })), /\(x\) merge "review" needs a non-empty branchPrefix/);
  assert.throws(() => loadConfig(deskWith({ merge: 'review', branchPrefix: 'dev', defaultBranch: 'develop' })), /\(x\) merge "review" needs a defaultBranch outside branchPrefix: "develop" starts with "dev"/);
  assert.equal(loadConfig(deskWith({ branchPrefix: 'dev', defaultBranch: 'develop' })).repos[0].merge, 'direct', 'the overlap stays fine on direct');
  assert.equal(loadConfig(deskWith({ branchPrefix: '' })).repos[0].merge, 'direct', 'an empty prefix stays fine on direct');
});

// 6.3
test('a user-layer file holding merge or repos changes nothing', () => {
  const settings = join(tmp(), 'settings.json');
  writeFileSync(settings, JSON.stringify({ merge: 'review', repos: [{ id: 'a', merge: 'review' }, { id: 'z', path: '.' }], tasks: { review: { effort: 'medium' } } }));
  const prior = process.env.AGENT_DESK_SETTINGS;
  const f = fixture({ gh: 'o/r' });
  try {
    process.env.AGENT_DESK_SETTINGS = settings;
    const c = loadConfig(f.home);
    assert.equal(c.repos.find((r) => r.id === 'a').merge, 'direct');
    assert.ok(!c.repos.some((r) => r.id === 'z'));
    // The file is read: its allowed key applies while these two are only warned about.
    const s = JSON.parse(ok(f.run({}, 'settings', '--json')));
    assert.equal(s.tasks.review.effort, 'medium');
    for (const key of ['"merge"', '"repos"']) assert.ok(s.warnings.some((w) => w.includes(`unknown key ${key}`)), key);
    ok(f.run({}, 'wt', 'merge', 'demo'));
  } finally { process.env.AGENT_DESK_SETTINGS = prior; }
  assert.deepEqual(f.mainHeads(), [f.sha, f.sha], 'still direct: the merge happened here');
  assert.equal(f.prCalls().length, 0);

  // And the other way: a user layer cannot turn a review repo back to direct.
  const r = fixture(REVIEW);
  writeFileSync(settings, JSON.stringify({ merge: 'direct', repos: [{ id: 'a', merge: 'direct' }] }));
  try {
    process.env.AGENT_DESK_SETTINGS = settings;
    ok(r.run({}, 'wt', 'merge', 'demo', '--findings', r.findings));
  } finally { process.env.AGENT_DESK_SETTINGS = prior; }
  untouched(r);
  assert.equal(r.prCalls()[0].args[3], 'create');
});

// 6.4
test('review: each gate refuses on its own, with the direct message, and creates nothing', () => {
  const unpushed = fixture(REVIEW);
  commit(unpushed.wt, 'two.txt', 'two\n');
  fails(unpushed.run({}, 'wt', 'merge', 'demo', '--findings', unpushed.findings), /has unpushed commits; run desk wt finish demo first/);
  untouched(unpushed); assert.equal(unpushed.prCalls().length, 0);

  const red = fixture(REVIEW);
  fails(red.run({ runs: [{ status: 'completed', conclusion: 'failure', databaseId: 1 }] }, 'wt', 'merge', 'demo', '--findings', red.findings), /CI on agent\/demo .* is 'failure', not success/);
  untouched(red); assert.equal(red.prCalls().length, 0);

  const noVerdict = fixture(REVIEW, { verdict: false });
  fails(noVerdict.run({}, 'wt', 'merge', 'demo', '--findings', noVerdict.findings), /merge blocked: .*desk board post verdict demo "MERGE @/);
  untouched(noVerdict); assert.equal(noVerdict.prCalls().length, 0);

  const noFindings = fixture(REVIEW);
  fails(noFindings.run({}, 'wt', 'merge', 'demo'), /--findings <file>.*nothing was created/);
  untouched(noFindings); assert.equal(noFindings.prCalls().length, 0);
});

test('review: all gates pass opens the PR, moves nothing, and a re-run updates the body', () => {
  const f = fixture(REVIEW);
  const out = ok(f.run({ prs: [{ ...pr('OPEN', f.sha, 99), isCrossRepository: true }] }, 'wt', 'merge', 'demo', '--findings', f.findings));
  assert.match(out, /https:\/\/github\.example\/o\/r\/pull\/7/, 'a fork row is not our PR: ours is created');
  assert.deepEqual(f.calls().find((c) => c.args[2] === 'pr' && c.args[3] === 'list').args, ['-R', 'o/r', 'pr', 'list', '--head', 'agent/demo', '--state', 'all', '--json', 'number,state,headRefOid,url,isCrossRepository']);
  untouched(f);
  const [create] = f.prCalls();
  assert.deepEqual(create.args, ['-R', 'o/r', 'pr', 'create', '--base', 'main', '--head', 'agent/demo', '--title', 'edit one.txt', '--body-file', '-']);
  assert.match(create.stdin, /no findings/, 'the body reaches stdin of a real child');
  assert.ok(!create.args.join(' ').includes('no findings'), 'the body is never in argv');
  assert.equal(board(f.home).at(-1).text, `PR #7 opened @${f.sha.slice(0, 7)}`);
  assert.ok(!f.calls().some((c) => c.args[3] === 'edit'), 'no edit on the fork\'s PR');
  assert.ok(!board(f.home).some((p) => ['merged', 'release'].includes(p.kind)), 'claim and worktree stay');

  writeFileSync(f.findings, 'second review\n');
  ok(f.run({ prs: [pr('OPEN', f.sha)] }, 'wt', 'merge', 'demo', '--findings', f.findings));
  const edit = f.prCalls().at(-1);
  assert.deepEqual(edit.args, ['-R', 'o/r', 'pr', 'edit', '7', '--body-file', '-']);
  assert.match(edit.stdin, /second review/);
  assert.doesNotMatch(edit.stdin, /no findings/, 'the whole body is rewritten');
  untouched(f);
});

// 6.5
test('review fails closed: no gh value, no origin, gh missing, gh failing; never a fast-forward', () => {
  const noGh = fixture({ merge: 'review' });
  fails(noGh.run({}, 'wt', 'merge', 'demo', '--findings', noGh.findings), /merge: review needs gh and origin on a; nothing was merged/);
  untouched(noGh); assert.equal(noGh.calls().length, 0);

  const { root, home } = multiDesk();
  ok(desk(home, 'wt', 'new', 'local', '--repo', 'b'));
  setRepo(home, 'b', REVIEW);
  const before = git(join(root, 'b'), 'rev-parse', 'main');
  commit(join(root, 'worktrees', 'b-local'), 'x.txt', 'x\n');
  const stubFile = join(tmp(), 'gh.json');
  fails(stubbed(home, stubFile, {}, 'wt', 'merge', 'local'), /merge: review needs gh and origin on b; nothing was merged/);
  assert.ok(!existsSync(`${stubFile}.log`), 'refused before any gh call');
  assert.equal(git(join(root, 'b'), 'rev-parse', 'main'), before);

  const missing = fixture(REVIEW);
  fails(missing.run({ missing: true }, 'wt', 'merge', 'demo', '--findings', missing.findings), /gh is not installed; nothing was merged/);
  untouched(missing);

  const failing = fixture(REVIEW);
  fails(failing.run({ fail: 'pr list' }, 'wt', 'merge', 'demo', '--findings', failing.findings), /gh pr list failed: gh says boom; nothing was merged/);
  untouched(failing);

  const noCreate = fixture(REVIEW);
  fails(noCreate.run({ fail: 'pr create' }, 'wt', 'merge', 'demo', '--findings', noCreate.findings), /Command failed/);
  untouched(noCreate);
  assert.ok(!board(noCreate.home).some((p) => p.kind === 'merged' || p.text?.startsWith('PR #')));
});

// 6.6
for (const [name, land] of [
  ['squash or rebase', (f) => serverMain(f.bare, serverCommit(f.bare, f.before[0]))],
  ['merge commit', (f) => serverMain(f.bare, serverCommit(f.bare, f.before[0], f.sha))],
]) {
  test(`close after a ${name} on the server`, () => {
    const f = fixture(REVIEW);
    ok(f.run({}, 'todo', 'add', 'the work', '--area', 'a'));
    ok(f.run({}, 'todo', 'start', 'T-1', '--slug', 'demo'));
    git(f.bare, 'update-ref', 'refs/pull/7/head', f.sha);
    land(f);
    ok(f.run({ prs: [pr('MERGED', f.sha)] }, 'wt', 'merge', 'demo'));
    closed(f, 'PR #7');
    assert.equal(JSON.parse(ok(f.run({}, 'todo', 'show', 'T-1'))).status, 'done');
  });
}

test('close after "Update branch" on top: the local head is an ancestor of the PR head', () => {
  const f = fixture(REVIEW);
  const bump = serverCommit(f.bare, f.before[0]);
  const updated = serverCommit(f.bare, f.sha, bump);
  git(f.bare, 'update-ref', 'refs/pull/7/head', updated);
  serverMain(f.bare, serverCommit(f.bare, bump));
  ok(f.run({ prs: [pr('MERGED', updated)] }, 'wt', 'merge', 'demo'));
  closed(f, 'PR #7');
});

test('close when the branch is deleted on the server, and the tracking ref with it', () => {
  const f = fixture(REVIEW);
  git(f.bare, 'update-ref', 'refs/pull/7/head', f.sha);
  git(f.bare, 'update-ref', '-d', 'refs/heads/agent/demo');
  git(f.main, 'update-ref', '-d', 'refs/remotes/origin/agent/demo');
  ok(f.run({ prs: [pr('MERGED', f.sha)] }, 'wt', 'merge', 'demo'));
  closed(f, 'PR #7');
});

test('local commits not in the merged PR are not closed and go on to a new PR', () => {
  const f = fixture(REVIEW);
  git(f.bare, 'update-ref', 'refs/pull/7/head', f.sha);
  const newer = commit(f.wt, 'two.txt', 'two\n');
  git(f.wt, 'push', '-q', 'origin', 'agent/demo');
  ok(f.run({}, 'board', 'post', 'verdict', 'demo', `MERGE @${newer}`));
  ok(f.run({ prs: [pr('MERGED', f.sha)] }, 'wt', 'merge', 'demo', '--findings', f.findings));
  untouched(f);
  assert.equal(f.prCalls()[0].args[3], 'create');
  assert.ok(!board(f.home).some((p) => p.kind === 'merged'));
});

test('a MERGED PR whose head cannot be fetched is no proof', () => {
  const f = fixture(REVIEW);
  fails(f.run({ prs: [pr('MERGED', f.sha)] }, 'wt', 'merge', 'demo'), /--findings/);
  untouched(f);
  assert.ok(!board(f.home).some((p) => p.kind === 'merged'));
});

test('several PRs: the open one wins, else the newest', () => {
  const f = fixture(REVIEW);
  const out = ok(f.run({ prs: [pr('CLOSED', f.sha, 3), pr('OPEN', f.sha, 5), pr('CLOSED', f.sha, 9)] }, 'wt', 'merge', 'demo'));
  assert.match(out, /PR #5 is OPEN/);
  // Newest by number, whatever order gh answers in: #9 is closed at this head, so it refuses.
  fails(f.run({ prs: [pr('MERGED', 'f'.repeat(40), 2), pr('CLOSED', f.sha, 9), pr('CLOSED', 'e'.repeat(40), 4)] }, 'wt', 'merge', 'demo', '--findings', f.findings), /PR #9 was closed unmerged/);
  untouched(f);
});

test('closed unmerged at this head is refused; closed at an older head goes on', () => {
  const f = fixture(REVIEW);
  fails(f.run({ prs: [pr('CLOSED', f.sha)] }, 'wt', 'merge', 'demo', '--findings', f.findings), /PR #7 was closed unmerged at this head; add commits and get a new verdict, or desk wt discard demo/);
  untouched(f);
  assert.equal(f.prCalls().length, 0);
  ok(f.run({ prs: [pr('CLOSED', 'e'.repeat(40))] }, 'wt', 'merge', 'demo', '--findings', f.findings));
  assert.equal(f.prCalls()[0].args[3], 'create');
});

test('open PR with no --findings prints state and URL and writes nothing, even with gates failing', () => {
  const f = fixture(REVIEW, { verdict: false });
  const posts = board(f.home).length;
  const out = ok(f.run({ prs: [pr('OPEN', f.sha)] }, 'wt', 'merge', 'demo'));
  assert.match(out, /PR #7 is OPEN: https:\/\/github\.example\/o\/r\/pull\/7/);
  assert.equal(f.prCalls().length, 0);
  assert.equal(board(f.home).length, posts);
  untouched(f);
});

// 6.7
test('wt remove on an unmerged branch: the pointer on review only, and nothing removed', () => {
  const r = fixture(REVIEW);
  fails(r.run({}, 'wt', 'remove', 'demo'), /is not in origin\/main yet; merge it first\. If its PR was merged on the server, close it with desk wt merge demo/);
  untouched(r);
  const d = fixture({});
  const e = d.run({}, 'wt', 'remove', 'demo');
  fails(e, /is not in origin\/main yet; merge it first/);
  assert.doesNotMatch(e.stderr, /desk wt merge/);
  untouched(d);
});

// 6.8
// Two worktrees of one repo, each with its own commit. `b` has no remote and no gh: --into needs neither.
function intoFixture(policy, { same = false } = {}) {
  const { root, home } = multiDesk();
  setRepo(home, 'b', { merge: policy });
  ok(desk(home, 'wt', 'new', 'src', '--repo', 'b'));
  ok(desk(home, 'wt', 'new', 'dst', '--repo', 'b'));
  const src = join(root, 'worktrees', 'b-src'), dst = join(root, 'worktrees', 'b-dst');
  commit(src, same ? 'same.txt' : 's.txt', 'from src\n');
  commit(dst, same ? 'same.txt' : 'd.txt', 'from dst\n');
  return { root, home, src, dst, main: join(root, 'b'), srcHead: git(src, 'rev-parse', 'HEAD'), dstHead: git(dst, 'rev-parse', 'HEAD') };
}

for (const policy of ['direct', 'review']) {
  test(`--into on ${policy}: a clean merge closes the source and moves only the target`, () => {
    const f = intoFixture(policy);
    const mainHead = git(f.main, 'rev-parse', 'main');
    ok(desk(f.home, 'todo', 'add', 'the source', '--area', 'b'));
    ok(desk(f.home, 'todo', 'start', 'T-1', '--slug', 'src'));
    ok(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst'));
    assert.notEqual(git(f.dst, 'rev-parse', 'HEAD'), f.dstHead);
    assert.ok(existsSync(join(f.dst, 's.txt')));
    assert.equal(git(f.main, 'rev-parse', 'main'), mainHead, 'the default branch does not move');
    assert.ok(!existsSync(join(f.src, '.git')), 'the source worktree is gone');
    assert.equal(git(f.main, 'branch', '--list', 'agent/src'), '');
    assert.equal(git(f.main, 'branch', '--list', 'agent/dst').replace('+', '').trim(), 'agent/dst');
    assert.equal(board(f.home).filter((p) => p.kind === 'merged').at(-1).text, 'into agent/dst');
    const todo = JSON.parse(ok(desk(f.home, 'todo', 'show', 'T-1')));
    assert.equal(todo.status, 'done');
    assert.match(todo.notes.at(-1), /merged into agent\/dst \(src\)$/, 'the todo names the target');
  });
}

test('--into conflict: aborts, names the file, both as they were; re-run after a hand merge closes', () => {
  const f = intoFixture('direct', { same: true });
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst'), /conflict in same\.txt.*both are as they were/);
  assert.equal(git(f.dst, 'rev-parse', 'HEAD'), f.dstHead);
  assert.equal(git(f.src, 'rev-parse', 'HEAD'), f.srcHead);
  assert.equal(git(f.dst, 'status', '--porcelain'), '');
  assert.ok(existsSync(join(f.src, '.git')));
  assert.ok(!board(f.home).some((p) => p.kind === 'merged'));

  // The hand merge: a person resolves it in the target, then re-runs.
  spawnSync('git', ['-C', f.dst, 'merge', '--no-edit', 'agent/src'], { env: env(''), stdio: 'ignore' });
  writeFileSync(join(f.dst, 'same.txt'), 'both\n');
  git(f.dst, 'add', 'same.txt');
  git(f.dst, 'commit', '-q', '--no-edit');
  const handMerged = git(f.dst, 'rev-parse', 'HEAD');
  ok(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst'));
  assert.equal(git(f.dst, 'rev-parse', 'HEAD'), handMerged, 'no second merge');
  assert.ok(!existsSync(join(f.src, '.git')));
});

test('--into gates: dirty, wrong branch, a claim by another session, another repo, --findings', () => {
  const f = intoFixture('direct');
  writeFileSync(join(f.dst, 'scratch.txt'), 'x');
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst'), /has uncommitted changes/);
  git(f.dst, 'clean', '-fdq');

  writeFileSync(join(f.src, 'scratch.txt'), 'x');
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst'), /has uncommitted changes/);
  git(f.src, 'clean', '-fdq');

  git(f.dst, 'checkout', '-q', '-b', 'other');
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst'), /must be on agent\/dst/);
  git(f.dst, 'checkout', '-q', 'agent/dst');

  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst', '--findings', 'x.md'), /--findings goes with a PR/);
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'src'), /another worktree/);
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'nope'), /no worktree of b/);

  ok(desk(f.home, 'wt', 'new', 'elsewhere', '--repo', 'a'));
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'elsewhere'), /no worktree of b .*same repo/);

  appendFileSync(join(f.home, 'board.jsonl'), JSON.stringify({ at: new Date().toISOString(), from: 'othersess', kind: 'claim', slug: 'dst', repo: 'b', text: 'mine' }) + '\n');
  fails(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst'), /dst is claimed by session othersess.*--force/);
  assert.equal(git(f.dst, 'rev-parse', 'HEAD'), f.dstHead, 'no gate moved the target');
  assert.ok(existsSync(join(f.src, '.git')), 'no gate removed the source');
  ok(desk(f.home, 'wt', 'merge', 'src', '--into', 'dst', '--force'));
  assert.ok(!existsSync(join(f.src, '.git')));
});

// 6.13
test('PR body: everything live stays inside a fence longer than any run in the findings', () => {
  const findings = 'see ```` here, @someone fixed #1\n<img src=x onerror=alert(1)>\n[link](http://x)\n';
  const body = prBody('a'.repeat(40), findings, 'abc1234 subject @other #2 `tick`');
  const [before, rest] = [body.slice(0, body.indexOf('`````')), body.slice(body.indexOf('`````'))];
  assert.equal(before, `Reviewed: MERGE @${'a'.repeat(40)}\n\n## Findings\n\n`);
  assert.match(rest, /^`````\nsee ```` here, @someone fixed #1\n<img src=x onerror=alert\(1\)>\n\[link\]\(http:\/\/x\)\n`````\n\n## Commits\n\n```\nabc1234 subject @other #2 `tick`\n```\n$/);
});

test('PR body: size limit, and a secret refused anywhere', () => {
  const sha = 'a'.repeat(40);
  assert.ok(prBody(sha, 'x'.repeat(60000), ''));
  assert.throws(() => prBody(sha, 'x'.repeat(60001), ''), /over the 60000 limit; nothing was sent/);
  assert.throws(() => prBody(sha, `a key ${KEY} here`, ''), /shaped like a secret/);
  assert.throws(() => prBody(sha, 'clean', `abc1234 add ${KEY}`), /shaped like a secret/);
  assert.throws(() => prBody(sha, `db ${['postgres://user', 'hunter22@host/db'].join(':')}`, ''), /shaped like a secret/);
  assert.throws(() => prBody(sha, `db ${['redis://', 'hunter22@host'].join(':')}`, ''), /shaped like a secret/);
  assert.throws(() => prBody(sha, `API_TOKEN=${['prod-live', 'xK29Lm4Pq7Rt5Vw8Zn3Bc6Df'].join('-')}`, ''), /shaped like a secret/);
  assert.ok(prBody(sha, 'key: /api/v2/keys/rotate and token: user_profile_settings_v2', ''), 'a path or code name beside a key name is not a key');
  assert.ok(prBody(sha, 'db postgres://user:${pass}@host/db', ''), 'a template placeholder is source text');
  assert.throws(() => prBody(sha, `db ${['postgres://app', 'p@' + 'ssw0rd@db'].join(':')}`, ''), /shaped like a secret/);
  assert.ok(prBody(sha, 'db postgres://app:${PASS}@h:5432?x=a', ''), 'a template placeholder takes no piece after an @');
  assert.throws(() => prBody(sha, '{"Key": "photos/2024/SummerTrip/IMG1234.jpg"}', ''), /shaped like a secret/);
});

test('hasSecret holds no state between calls', () => {
  for (let i = 0; i < 3; i++) assert.equal(hasSecret(`x ${KEY}`), true);
  assert.equal(hasSecret('nothing here'), false);
});

test('PR body through the CLI: no verdict free text, no desk path; a secret or oversize sends nothing', () => {
  const f = fixture(REVIEW, { verdict: false });
  ok(f.run({}, 'board', 'post', 'verdict', 'demo', `MERGE @${f.sha} by opus/high`));
  ok(f.run({}, 'wt', 'merge', 'demo', '--findings', f.findings));
  const { stdin } = f.prCalls()[0];
  assert.match(stdin, new RegExp(`^Reviewed: MERGE @${f.sha}\\n`));
  assert.doesNotMatch(stdin, /opus|high/);
  assert.ok(!stdin.includes(f.root) && !stdin.includes(f.root.replace(/\\/g, '/')), 'no absolute desk path');

  const g = fixture(REVIEW);
  writeFileSync(g.findings, `oops ${KEY}\n`);
  fails(g.run({}, 'wt', 'merge', 'demo', '--findings', g.findings), /shaped like a secret/);
  writeFileSync(g.findings, 'x'.repeat(60001));
  fails(g.run({}, 'wt', 'merge', 'demo', '--findings', g.findings), /over the 60000 limit/);
  fails(g.run({}, 'wt', 'merge', 'demo', '--findings', join(g.root, 'missing.md')), /cannot read .*nothing was sent/);
  assert.equal(g.prCalls().length, 0);
  untouched(g);
});

// ---- desk check: the server answers through an injected exec, git stays real ----
const GUARANTEE = 'only a server rule is a guarantee';
function checks(home, answer = () => ({ protected: true })) {
  const calls = [];
  const lines = mergeChecks(loadConfig(home), (cmd, args, o) => {
    if (cmd !== 'gh') return execFileSync(cmd, args, o);
    calls.push(args.join(' '));
    return JSON.stringify(answer(args[1]));
  });
  return { lines, calls };
}
const boom = (o) => { throw Object.assign(new Error('Command failed: gh'), o); };
const NOT_FOUND = { stderr: 'gh: Not Found (HTTP 404)\n' };
const UNREAD = (id, b, why) => `warn ${id} cannot read protection of ${b}: ${why}; ${GUARANTEE}`;

test('protection check: the default branch, each answer one line, nothing throws', () => {
  const { home } = multiDesk();
  setRepo(home, 'a', { merge: 'review', gh: 'o/r' });
  const rules = (list) => (p) => (p.includes('/rules/') ? list : { protected: false });
  assert.deepEqual(checks(home), { lines: ['ok   a main protected on the server'], calls: ['api repos/o/r/branches/main'] });
  assert.deepEqual(checks(home, rules([{ type: 'pull_request' }])), {
    lines: ['ok   a main protected on the server'], calls: ['api repos/o/r/branches/main', 'api repos/o/r/rules/branches/main'] });
  assert.deepEqual(checks(home, rules([])).lines, [`warn a main has no branch protection on the server; ${GUARANTEE}`]);
  const on = (p, e) => (path) => (path.includes(p) ? boom(e) : { protected: false });
  assert.deepEqual(checks(home, on('/rules/', { stderr: 'gh: Upgrade to GitHub Pro (HTTP 403)\n' })).lines, [UNREAD('a', 'main', 'gh: Upgrade to GitHub Pro (HTTP 403)')]);
  assert.deepEqual(checks(home, on('/branches/', NOT_FOUND)).lines, [UNREAD('a', 'main', 'gh: Not Found (HTTP 404)')], 'a 404 on the default branch is reported');
  assert.deepEqual(checks(home, on('/branches/', { code: 'ENOENT' })).lines, [UNREAD('a', 'main', 'gh is not installed')]);
  assert.deepEqual(checks(home, on('/branches/', { code: 'ETIMEDOUT' })).lines, [UNREAD('a', 'main', 'no answer in 15 s')]);
});

test('protection check: an extra main is read too, and a 404 on it says nothing', () => {
  const { home } = multiDesk();
  setRepo(home, 'a', { merge: 'review', gh: 'o/r', defaultBranch: 'develop' });
  const develop = 'ok   a develop protected on the server';
  const main = (a) => (p) => (p.endsWith('/main') ? a(p) : { protected: true });
  assert.deepEqual(checks(home, main(() => boom(NOT_FOUND))).lines, [develop]);
  assert.deepEqual(checks(home, main(() => ({ protected: true }))).lines, [develop, 'ok   a main protected on the server']);
  assert.deepEqual(checks(home, main((p) => (p.includes('/rules/') ? [] : { protected: false }))).lines, [develop, `warn a main has no branch protection on the server; ${GUARANTEE}`]);
  // The branch exists, so a 404 from the rules call is a read that failed, not a missing branch.
  assert.deepEqual(checks(home, main((p) => (p.includes('/rules/') ? boom(NOT_FOUND) : { protected: false }))).lines, [develop, UNREAD('a', 'main', 'gh: Not Found (HTTP 404)')]);
});

test('protection check: no gh value or no origin warns that wt merge refuses, with no call', () => {
  const { home } = multiDesk();
  setRepo(home, 'a', { merge: 'review' });
  setRepo(home, 'b', { merge: 'review', gh: 'o/b' });
  assert.deepEqual(checks(home), { calls: [], lines: [
    `warn a has merge "review" and no gh value: wt merge will refuse on this repo; ${GUARANTEE}`,
    `warn b has merge "review" and no origin: wt merge will refuse on this repo; ${GUARANTEE}`,
  ] });
});

function tracked(dir, file = 'desk.config.json') {
  git(dir, 'init', '-q');
  git(dir, 'add', file);
  git(dir, 'commit', '-qm', 'desk');
}
const flags = (home) => checks(home).lines.filter((l) => l.includes('merge changed'));
const changed = (id, was, now) => `warn ${id} merge changed in desk.config.json: ${was} -> ${now}; ${GUARANTEE}`;
const dropRepo = (home, id) => {
  const file = join(home, 'desk.config.json'), cfg = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify({ ...cfg, repos: cfg.repos.filter((r) => r.id !== id) }, null, 2));
};

test('change flag: a BOM in desk.config.json still flags a flip', () => {
  const { home } = multiDesk();
  setRepo(home, 'a', { merge: 'review', gh: 'o/r' });
  tracked(home);
  setRepo(home, 'a', { merge: 'direct' });
  const file = join(home, 'desk.config.json');
  writeFileSync(file, `\u{FEFF}${readFileSync(file, 'utf8')}`);
  assert.deepEqual(flags(home), [changed('a', 'review', 'direct')]);
});

test('direct: no line and no gh call from the check, with the desk in git or not', () => {
  const { home } = multiDesk();
  setRepo(home, 'a', { gh: 'o/r' });
  setRepo(home, 'b', { merge: 'direct' });
  assert.deepEqual(checks(home), { lines: [], calls: [] });
  tracked(home);
  assert.deepEqual(checks(home), { lines: [], calls: [] });
});

test('change flag: either way against HEAD; a removed entry; nothing when the same or not in git', () => {
  const { home } = multiDesk();
  setRepo(home, 'a', { merge: 'review', gh: 'o/r' });
  assert.deepEqual(flags(home), [], 'not in git');
  tracked(home);
  assert.deepEqual(flags(home), [], 'same as HEAD');
  setRepo(home, 'a', { merge: 'direct' });
  assert.deepEqual(checks(home), { lines: [changed('a', 'review', 'direct')], calls: [] }, 'an all-direct file still flags the flip back');
  setRepo(home, 'a', { merge: 'review' });
  dropRepo(home, 'b');
  assert.deepEqual(flags(home), [], 'a removed direct entry is no policy change');
  dropRepo(home, 'a');
  assert.deepEqual(flags(home), [changed('a', 'review', 'missing')]);
});

test('change flag: the other way, and the desk folder nested in a larger repo', () => {
  const { root, home } = multiDesk();
  tracked(root, 'desk/desk.config.json');
  assert.deepEqual(flags(home), []);
  setRepo(home, 'a', { merge: 'review', gh: 'o/r' });
  assert.deepEqual(flags(home), [changed('a', 'direct', 'review')]);
});

test('change flag: the upstream wins over HEAD, so a local commit does not hide the change', () => {
  const { home } = multiDesk();
  setRepo(home, 'a', { merge: 'review', gh: 'o/r' });
  tracked(home);
  const bare = join(tmp(), 'desk.git');
  git(home, 'init', '-q', '--bare', bare);
  git(home, 'remote', 'add', 'origin', bare);
  git(home, 'push', '-q', '-u', 'origin', 'HEAD');
  setRepo(home, 'a', { merge: 'direct' });
  git(home, 'commit', '-qam', 'direct again');
  assert.deepEqual(flags(home), [changed('a', 'review', 'direct')]);
});

// ---- desk status ----
const rowInput = (reviewPrs) => ({ t: new Map(), board: [], rows: [], runs: [], heads: new Map([['x', 'abc1234']]), overlaps: [], reviewPrs,
  branches: new Map([['x', { branch: 'agent/x', repo: 'a', gh: 'o/r' }]]) });
const prRow = (number, state, repo = 'a') => ({ number, state, headRefName: 'agent/x', url: `https://github.example/o/r/pull/${number}`, repo });

test('status: the row text for each PR state; the open one wins, else the newest; another repo never matches', () => {
  const text = (...prs) => statusText(rowInput(prs)).split('\n').find((l) => l.startsWith('- x @'));
  assert.match(text(prRow(3, 'OPEN')), /; PR #3 open, a person merges$/);
  assert.match(text(prRow(3, 'MERGED')), /; PR #3 merged: desk wt merge x to close$/);
  assert.match(text(prRow(3, 'CLOSED')), /; PR #3 closed unmerged$/);
  assert.match(text(prRow(9, 'CLOSED'), prRow(3, 'OPEN')), /PR #3 open/);
  assert.match(text(prRow(2, 'MERGED'), prRow(5, 'CLOSED')), /PR #5 closed unmerged/);
  assert.deepEqual(statusData(rowInput([prRow(3, 'OPEN')])).branches[0].pr, { number: 3, state: 'OPEN', url: 'https://github.example/o/r/pull/3' });
  assert.equal('pr' in statusData(rowInput([prRow(3, 'OPEN', 'b')])).branches[0], false);
  assert.doesNotMatch(text(), /PR #/);
});

test('status --json: review rows carry pr and validate; a failed lookup leaves the row and exit 0', () => {
  const f = fixture({ gh: 'o/r', merge: 'review' });
  const open = { number: 7, state: 'OPEN', headRefName: 'agent/demo', url: 'https://github.example/o/r/pull/7' };
  const o = JSON.parse(ok(f.run({ prs: [open] }, 'status', '--json')));
  assert.deepEqual(validate(schema('desk-status'), o), []);
  assert.deepEqual(o.branches.find((b) => b.slug === 'demo').pr, { number: 7, state: 'OPEN', url: open.url });
  assert.equal(o.roots.find((r) => r.id === 'a').merge, 'review');
  assert.equal('merge' in o.roots.find((r) => r.id === 'b'), false);
  assert.match(o.text, /- a: review, git, CI o\/r /);
  assert.match(o.text, /PR #7 open, a person merges/);
  assert.deepEqual(f.calls().find((c) => c.args[2] === 'pr' && c.args[3] === 'list').args, ['-R', 'o/r', 'pr', 'list', '--state', 'all', '--limit', '100', '--json', 'number,state,headRefName,headRefOid,url,isCrossRepository']);
  const fork = JSON.parse(ok(f.run({ prs: [{ ...open, number: 9, isCrossRepository: true }] }, 'status', '--json')));
  assert.equal('pr' in fork.branches.find((b) => b.slug === 'demo'), false, 'a fork row does not show');

  const down = JSON.parse(ok(f.run({ prs: [open], fail: 'pr list' }, 'status', '--json')));
  assert.deepEqual(validate(schema('desk-status'), down), []);
  const row = down.branches.find((b) => b.slug === 'demo');
  assert.ok(f.sha.startsWith(row.head));
  assert.equal('pr' in row, false);
});

test('status: a merged PR that does not hold the row\'s head says merged, without the close hint', () => {
  const input = (held, heads) => ({ ...rowInput([{ ...prRow(3, 'MERGED'), headRefOid: 'def5678ffff' }]), held, ...(heads ? { heads } : {}) });
  const text = (i) => statusText(i).split('\n').find((l) => l.startsWith('- x @'));
  const stale = (i) => statusData(i).branches[0].pr.stale;
  // gatherStatus asks git: false = the PR head is not a descendant of the local head, absent/true = held or unknown
  assert.match(text(input(new Map([['x', false]]))), /; PR #3 merged$/);
  assert.equal(stale(input(new Map([['x', false]]))), true);
  assert.deepEqual(validate(schema('desk-status'), { ...statusData(input(new Map([['x', false]]))), text: '' }), []);
  // Update branch: the PR head sits on top of the local head, so wt merge would close it
  assert.match(text(input(new Map([['x', true]]))), /; PR #3 merged: desk wt merge x to close$/);
  assert.equal(stale(input(new Map([['x', true]]))), undefined);
  // the object is missing locally (no fetch): unknown, not stale
  assert.match(text(input(new Map())), /: desk wt merge x to close$/);
  // no head known: never stale
  assert.equal(stale(input(new Map([['x', false]]), new Map([['x', '']]))), undefined);
});

test('status --cached: no gh call when answers are kept, local files fresh, asks when none can be read', () => {
  const f = fixture(REVIEW);
  const kept = join(f.home, 'scratch', 'status-gh.json');
  // runs and graphql give ci and the top-level prs real values to keep.
  const open = {
    prs: [{ number: 7, state: 'OPEN', headRefName: 'agent/demo', url: 'u' }],
    runs: [{ headBranch: 'agent/demo', headSha: f.sha, status: 'completed', conclusion: 'success' }],
    graphql: [{ number: 7, headRefName: 'agent/demo', reviewDecision: 'APPROVED', comments: { totalCount: 1, nodes: [] } }],
  };
  const status = (answers, ...flags) => JSON.parse(ok(f.run(answers, 'status', ...flags, '--json')));

  // Nothing kept yet: --cached asks once and keeps the answers.
  const first = status(open, '--cached');
  const asked = f.calls().length;
  assert.ok(asked > 0);
  assert.equal(first.branches.find((b) => b.slug === 'demo').pr.number, 7);
  assert.match(first.branches.find((b) => b.slug === 'demo').ci, /success/);
  assert.equal(first.prs[0].number, 7);

  // Kept: GitHub says otherwise now, but no call goes out, and the todo written since shows.
  ok(desk(f.home, 'todo', 'add', 'written since', '--area', 'a'));
  const cached = status({ prs: [], runs: [], graphql: [] }, '--cached');
  assert.equal(f.calls().length, asked);
  assert.equal(cached.branches.find((b) => b.slug === 'demo').pr.number, 7);
  assert.deepEqual(cached.branches.map((b) => b.ci), first.branches.map((b) => b.ci));
  assert.deepEqual(cached.prs, first.prs);
  assert.ok(cached.todos.some((t) => t.title === 'written since'));

  // A plain run asks as it did, and what it heard is what --cached then shows.
  const plain = status({ prs: [] });
  assert.equal(f.calls().length, asked * 2);
  assert.equal(plain.branches.find((b) => b.slug === 'demo').pr, undefined);
  assert.equal(status(open, '--cached').branches.find((b) => b.slug === 'demo').pr, undefined);
  assert.equal(f.calls().length, asked * 2);

  // A torn or missing keeper falls back to asking, and is whole again after.
  for (const lose of [() => writeFileSync(kept, '{"reviewPrs":['), () => rmSync(kept)]) {
    lose();
    const before = f.calls().length;
    status(open, '--cached');
    assert.equal(f.calls().length, before + asked);
    assert.equal(JSON.parse(readFileSync(kept, 'utf8')).reviewPrs[0].number, 7);
    status({ prs: [] }); // back to none, for the next round
  }
});

test('status: gh unreadable with nothing kept reads CI unavailable and leaves prs null', () => {
  const f = fixture({ gh: 'o/r', merge: 'review' });
  const s = JSON.parse(ok(f.run({ missing: true }, 'status', '--json')));
  assert.equal(s.branches.find((b) => b.slug === 'demo').ci, 'CI unavailable');
  assert.equal(s.prs, null);
});

test('status: a failed gh call keeps that repo\'s old CI, PR and review answers; an empty answer replaces them', () => {
  const f = fixture({ gh: 'o/r', merge: 'review' });
  setRepo(f.home, 'b', { gh: 'o/s', merge: 'review' });
  const kept = () => JSON.parse(readFileSync(join(f.home, 'scratch', 'status-gh.json'), 'utf8'));
  const by = (rows, id) => (rows ?? []).filter((x) => x.repo === id).length;
  const good = {
    prs: [{ number: 7, state: 'OPEN', headRefName: 'agent/demo', url: 'u' }],
    runs: [{ headBranch: 'agent/demo', headSha: f.sha, status: 'completed', conclusion: 'success' }],
    graphql: [{ number: 7, headRefName: 'agent/demo', reviewDecision: 'APPROVED', comments: { totalCount: 1, nodes: [] } }],
  };
  const empty = { prs: [], runs: [], graphql: [] };
  const status = (answers) => JSON.parse(ok(f.run(answers, 'status', '--json')));
  const counts = () => ['reviewPrs', 'runs', 'prs'].map((k) => [by(kept()[k], 'a'), by(kept()[k], 'b')]);

  status(good);
  assert.deepEqual(counts(), [[1, 1], [1, 1], [1, 1]]);
  for (const fail of ['pr list', 'run list', 'api']) {
    const down = status({ ...empty, fail });
    assert.deepEqual(counts(), { 'pr list': [[1, 1], [0, 0], [0, 0]], 'run list': [[0, 0], [1, 1], [0, 0]], api: [[0, 0], [0, 0], [1, 1]] }[fail], `${fail}: only its own answers survive`);
    if (fail === 'run list') assert.match(down.branches.find((b) => b.slug === 'demo').ci, /success/);
    status(good);
  }
  // One repo failing does not freeze the other: a answers (empty), b keeps.
  status({ ...empty, fail: 'pr list', failOnly: 'o/s' });
  assert.deepEqual(counts()[0], [0, 1]);
  status(good);
  status({ ...empty, fail: 'api', failOnly: 'o/s' });
  assert.deepEqual(counts()[2], [0, 1]);
  // Both answer, empty: gone.
  status(empty);
  assert.deepEqual(counts(), [[0, 0], [0, 0], [0, 0]]);
});

test('status: with nothing kept, one failing repo does not make a kind unavailable for the others', () => {
  const f = fixture({ gh: 'o/r', merge: 'review' });
  setRepo(f.home, 'b', { gh: 'o/s', merge: 'review' });
  const kept = () => JSON.parse(readFileSync(join(f.home, 'scratch', 'status-gh.json'), 'utf8'));
  const good = {
    prs: [{ number: 7, state: 'OPEN', headRefName: 'agent/demo', url: 'u' }],
    runs: [{ headBranch: 'agent/demo', headSha: f.sha, status: 'completed', conclusion: 'success' }],
    graphql: [{ number: 7, headRefName: 'agent/demo', reviewDecision: 'APPROVED', comments: { totalCount: 1, nodes: [] } }],
  };
  for (const fail of ['pr list', 'run list', 'api']) {
    rmSync(join(f.home, 'scratch', 'status-gh.json'), { force: true });
    const s = JSON.parse(ok(f.run({ ...good, fail, failOnly: 'o/s' }, 'status', '--json')));
    const k = kept();
    const key = { 'pr list': 'reviewPrs', 'run list': 'runs', api: 'prs' }[fail];
    assert.deepEqual(k[key].map((x) => x.repo), ['a'], `${fail}: repo a's rows are kept, not null`);
    if (fail === 'run list') assert.match(s.branches.find((b) => b.slug === 'demo').ci, /success/);
  }
  // every repo failing with nothing kept is still unavailable (null), not empty
  rmSync(join(f.home, 'scratch', 'status-gh.json'), { force: true });
  ok(f.run({ ...good, fail: 'run list' }, 'status', '--json'));
  assert.equal(kept().runs, null);
});

test('status: gatherStatus marks a merged PR stale only when git says it lacks the local head', () => {
  const f = fixture(REVIEW);
  const descendant = commit(f.wt, 'two.txt', 'two\n'); // the "Update branch" shape: on top of the local head
  git(f.wt, 'reset', '-q', '--hard', f.sha); // the object stays in the shared store
  const unrelated = git(f.wt, 'commit-tree', `${f.sha}^{tree}`, '-m', 'other'); // a root commit, not a descendant
  const row = (headRefOid) => JSON.parse(ok(f.run({ prs: [{ number: 7, state: 'MERGED', headRefName: 'agent/demo', headRefOid, url: 'https://github.example/o/r/pull/7' }] }, 'status', '--json'))).branches.find((b) => b.slug === 'demo').pr;
  const held = row(descendant);
  assert.equal(held.stale, undefined);
  assert.match(prText('demo', held), /: desk wt merge demo to close$/);
  assert.equal(row(unrelated).stale, true);
  assert.equal(row('f'.repeat(40)).stale, undefined, 'a head this clone lacks is unknown, not stale');
});

test('status: an open fork PR with the branch name does not fill the slug\'s PR review row', () => {
  const f = fixture({ gh: 'o/r', merge: 'review' });
  const node = { number: 5, headRefName: 'agent/demo', reviewDecision: 'CHANGES_REQUESTED', comments: { totalCount: 3, nodes: [] }, reviewThreads: { nodes: [] }, commits: { nodes: [] } };
  const prs = (...nodes) => JSON.parse(ok(f.run({ graphql: nodes }, 'status', '--json'))).prs;
  const fork = { ...node, number: 9, isCrossRepository: true };
  assert.deepEqual(prs(node).map((p) => p.number), [5]);
  assert.deepEqual(prs(fork, node).map((p) => p.number), [5], 'the fork comes first and still loses');
  assert.deepEqual(prs(fork), []);
  assert.match(f.calls().find((c) => c.args[0] === 'api').args.join(' '), /isCrossRepository/);
  // -f, not -F: -F turns a repo name like `2048` into a number and the query fails.
  assert.deepEqual(f.calls().find((c) => c.args[0] === 'api').args.slice(0, 7), ['api', 'graphql', '-f', 'owner=o', '-f', 'name=r', '-f']);
});

test('direct: status --json has no pr and no merge, and no extra gh call', () => {
  for (const fields of [{ gh: 'o/r' }, { gh: 'o/r', merge: 'direct' }]) {
    const f = fixture(fields);
    const o = JSON.parse(ok(f.run({ prs: [{ number: 7, state: 'OPEN', headRefName: 'agent/demo', url: 'u' }] }, 'status', '--json')));
    assert.equal('pr' in o.branches.find((b) => b.slug === 'demo'), false);
    assert.equal('merge' in o.roots.find((r) => r.id === 'a'), false);
    assert.equal(f.calls().filter((c) => c.args.includes('pr')).length, 0);
    assert.doesNotMatch(o.text, /review,|PR #/);
  }
});

test('wt finish: a failed gh call while waiting for the first CI run counts as no run yet', () => {
  const f = fixture({ gh: 'o/r' }, { verdict: false });
  const r = f.run({ failFirst: 1 }, 'wt', 'finish', 'demo');
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /: success \(1 run\)/);
  assert.ok(f.calls().filter((c) => c.args.includes('list') && c.args.includes('run')).length >= 2, 'gh run list was retried');
});

test('wt finish: at the CI wait deadline the error names the last gh failure, or just the 5 minutes', () => {
  const clockJump = 6 * 60000;
  for (const [stub, re] of [
    [{ runs: [], clockJump }, /no CI run found for \w+ after 5 minutes/],
    [{ fail: 'run list', clockJump }, /no CI run found for \w+; gh failed: gh says boom/],
    [{ runs: [], failFirst: 1, clockJump }, /no CI run found for \w+ after 5 minutes/], // a good empty call clears the earlier failure
  ]) {
    const f = fixture({ gh: 'o/r' }, { verdict: false });
    fails(f.run(stub, 'wt', 'finish', 'demo'), re);
  }
});

test('wt finish: the CI result read after the watch is retried; if it keeps failing the error says the result is unknown', () => {
  const f = fixture({ gh: 'o/r' }, { verdict: false });
  const r = f.run({ failAfter: 1, failFirst: 2 }, 'wt', 'finish', 'demo'); // call 1 finds the run, the read blips twice: only a third try succeeds
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /: success \(1 run\)/);
  const g = fixture({ gh: 'o/r' }, { verdict: false });
  fails(g.run({ failAfter: 1, failFirst: 99 }, 'wt', 'finish', 'demo'), /result for \w+ is unknown; gh failed: gh blip/);
});

test('wt finish: gh not installed fails at once, not after the CI wait', () => {
  const f = fixture({ gh: 'o/r' }, { verdict: false });
  const r = f.run({ missing: true }, 'wt', 'finish', 'demo');
  fails(r, /ENOENT/);
  assert.doesNotMatch(r.stderr, /gh failed/); // that text means it waited out the deadline first
});

test('status --watch: a repo whose gh call fails for one look keeps its rows, so no CI: line repeats and the PR: lines still print', () => {
  const f = fixture({ gh: 'o/r' });
  setRepo(f.home, 'b', { gh: 'o/s' });
  const stubFile = join(tmp(), 'gh.json');
  const runs = [{ headBranch: 'agent/demo', headSha: f.sha, status: 'completed', conclusion: 'success' }];
  const script = `import { look, carry, watchDiff } from ${JSON.stringify(pathToFileURL(BIN).href)};
    import { writeFileSync } from 'node:fs';
    const runs = ${JSON.stringify(runs)};
    const good = (d) => ({ runs, graphql: [{ number: 7, headRefName: 'agent/demo', reviewDecision: d, comments: { totalCount: 0, nodes: [] } }] });
    const next = (prev, i, o) => { writeFileSync(process.env.GH_STUB, JSON.stringify(o)); return carry(prev, look(i, prev)); };
    const out = {};
    for (const fail of ['run list', 'api']) {
      const first = next({}, 1, good('REVIEW_REQUIRED'));
      const down = next(first, 2, { ...good('REVIEW_REQUIRED'), fail, failOnly: 'o/s' });
      out[fail] = { kept: { runs: down.runs.filter((x) => x.repo === 'b').length, prs: down.prs.filter((x) => x.repo === 'b').length }, lines: watchDiff(down, next(down, 3, good('APPROVED'))).lines.filter((l) => /^(CI|PR):/.test(l)) };
    }
    console.log(JSON.stringify(out));`;
  writeFileSync(stubFile, '{}');
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: f.home, env: { ...env(f.home), GH_STUB: stubFile, NODE_OPTIONS: `--import=${STUB}` }, encoding: 'utf8' });
  const got = JSON.parse(ok(r).trim().split('\n').at(-1));
  for (const k of ['run list', 'api']) {
    // Both repos answer the same sha, so the CI: lines alone would not notice a lost row of b's.
    assert.deepEqual(got[k].kept, { runs: 1, prs: 1 }, `${k}: the failing repo keeps its rows`);
    assert.deepEqual(got[k].lines.filter((l) => l.startsWith('CI:')), [], `${k}: no CI: line repeats`);
    assert.equal(got[k].lines.filter((l) => l.startsWith('PR:')).length, 2, `${k}: both repos' PR: lines print`);
  }
});
