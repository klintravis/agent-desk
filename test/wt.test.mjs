import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, copyFileSync, statSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, delimiter } from 'node:path';
import { multiDesk, desk, git, commit, env, BIN } from './helpers.mjs';
import { conclusion, watchRuns, SESSION_ENV } from '../lib/wt.mjs';

const ok = (r) => { assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`); return r.stdout; };
const fails = (r, re) => { assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, re); };
const board = (home) => readFileSync(join(home, 'board.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('wt new -> finish -> merge gate -> merge, no gh (no CI)', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'a-demo');

  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a'));
  assert.equal(git(wt, 'branch', '--show-current'), 'agent/demo');
  assert.equal(JSON.parse(readFileSync(join(wt, '.claude', 'settings.local.json'), 'utf8')).env.DESK_HOME, home);
  assert.equal(git(wt, 'status', '--porcelain'), '', 'synced settings must not dirty the worktree');
  assert.deepEqual(board(home).at(-1), { ...board(home).at(-1), kind: 'claim', slug: 'demo', repo: 'a', from: 'testsess' });
  assert.match(readFileSync(join(home, 'desk.code-workspace'), 'utf8'), /wt demo \(a\)/);
  fails(desk(home, 'wt', 'new', 'demo', '--repo', 'b'), /already open in repo a/);

  ok(desk(home, 'todo', 'add', 'demo work', '--area', 'a'));
  ok(desk(home, 'todo', 'start', 'T-1', '--slug', 'demo'));
  const first = commit(wt, 'src/one.txt', 'one\n');
  writeFileSync(join(wt, 'dirty.txt'), 'x');
  fails(desk(home, 'wt', 'finish', 'demo'), /uncommitted changes/);
  git(wt, 'clean', '-fq');
  assert.match(ok(desk(home, 'wt', 'finish', 'demo')), /no CI wait/);

  fails(desk(home, 'wt', 'merge', 'demo'), /no verdict on the board/);
  ok(desk(home, 'board', 'post', 'verdict', 'demo', `MERGE @${first.slice(0, 7)}`));
  const second = commit(wt, 'src/two.txt', 'two\n');
  ok(desk(home, 'wt', 'finish', 'demo'));
  fails(desk(home, 'wt', 'merge', 'demo'), /commits after the review/);
  ok(desk(home, 'board', 'post', 'verdict', 'demo', `MERGE @${second}`));

  ok(desk(home, 'wt', 'merge', 'demo'));
  assert.equal(git(join(root, 'a.git'), 'rev-parse', 'main'), second, 'origin main fast-forwarded and pushed');
  assert.ok(!existsSync(join(wt, '.git')), 'worktree removed');
  assert.equal(git(join(root, 'a'), 'branch', '--list', 'agent/demo'), '');
  assert.deepEqual(board(home).slice(-2).map((l) => [l.kind, l.text.split(/[=;]/)[0]]), [['merged', 'main'], ['release', 'removed']]);
  assert.equal(JSON.parse(ok(desk(home, 'todo', 'show', 'T-1'))).status, 'done');
});

test('wt merge refuses a branch that is not pushed', () => {
  const { root, home } = multiDesk();
  ok(desk(home, 'wt', 'new', 'np', '--repo', 'a'));
  const sha = commit(join(root, 'worktrees', 'a-np'), 'f.txt', 'x\n');
  ok(desk(home, 'board', 'post', 'verdict', 'np', `MERGE @${sha}`));
  fails(desk(home, 'wt', 'merge', 'np'), /unpushed commits/);
});

test('local-only repo (no origin): finish runs the check without a push, merge fast-forwards locally', () => {
  const { root, home } = multiDesk();
  const p = join(home, 'desk.config.json'), cfg = JSON.parse(readFileSync(p, 'utf8'));
  cfg.repos[1].check = 'git status';
  writeFileSync(p, JSON.stringify(cfg));
  ok(desk(home, 'wt', 'new', 'loc', '--repo', 'b'));
  const sha = commit(join(root, 'worktrees', 'b-loc'), 'f.txt', 'x\n');
  assert.match(ok(desk(home, 'wt', 'finish', 'loc')), /> git status[\s\S]*No origin remote: nothing to push/);
  fails(desk(home, 'wt', 'merge', 'loc'), /no verdict/);
  ok(desk(home, 'board', 'post', 'verdict', 'loc', `MERGE @${sha}`));
  ok(desk(home, 'wt', 'merge', 'loc'));
  assert.equal(git(join(root, 'b'), 'rev-parse', 'main'), sha);
  assert.ok(!existsSync(join(root, 'worktrees', 'b-loc', '.git')));
});

test('a plain folder has no worktrees; without --repo the slug needs a git repo choice', () => {
  const { home } = multiDesk();
  fails(desk(home, 'wt', 'new', 'x', '--repo', 'notes'), /notes is a plain folder/);
  fails(desk(home, 'wt', 'new', 'x'), /several repos: pass --repo <a\|b>/);
});

test('wt discard drops worktree, branch and uncommitted work', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'b-junk');
  ok(desk(home, 'wt', 'new', 'junk', '--repo', 'b'));
  writeFileSync(join(wt, 'scratch.txt'), 'unsaved');
  // another session took the claim: discarding would throw its work away
  appendFileSync(join(home, 'board.jsonl'), JSON.stringify({ at: new Date().toISOString(), from: 'othersess', kind: 'claim', slug: 'junk', repo: 'b', text: 'mine now' }) + '\n');
  fails(desk(home, 'wt', 'discard', 'junk'), /claimed by session othersess.*--force/);
  assert.ok(existsSync(join(wt, 'scratch.txt')), 'nothing dropped');
  ok(desk(home, 'wt', 'discard', 'junk', '--force'));
  assert.ok(!existsSync(join(wt, '.git')));
  assert.equal(git(join(root, 'b'), 'branch', '--list', 'agent/junk'), '');
  assert.doesNotMatch(readFileSync(join(home, 'desk.code-workspace'), 'utf8'), /junk/);
  assert.deepEqual([board(home).at(-1).kind, board(home).at(-1).text], ['release', 'discarded']);
});

test('wt discard and remove refuse to run with the cwd inside the worktree', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'b-here'), sub = join(wt, 'src');
  ok(desk(home, 'wt', 'new', 'here', '--repo', 'b'));
  mkdirSync(sub);
  const before = board(home).length;
  for (const cmd of ['discard', 'remove', 'merge']) for (const cwd of [wt, sub]) {
    const r = spawnSync(process.execPath, [BIN, 'wt', cmd, 'here'], { cwd, env: env(home), encoding: 'utf8' });
    fails(r, /cd out of .* first/);
  }
  assert.ok(existsSync(join(wt, '.git')), 'worktree kept');
  assert.match(git(join(root, 'b'), 'branch', '--list', 'agent/here'), /agent\/here/);
  assert.equal(board(home).length, before, 'claim untouched');
  ok(desk(home, 'wt', 'discard', 'here'));
});

test('wt finish refuses a worktree that is not on agent/<slug>', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'b-sw');
  ok(desk(home, 'wt', 'new', 'sw', '--repo', 'b'));
  git(wt, 'checkout', '-q', '-b', 'other');
  fails(desk(home, 'wt', 'finish', 'sw'), /on 'other', not agent\/sw/);
});

test('CI conclusion over every run of a commit', () => {
  const run = (status, conclusion = '') => ({ status, conclusion });
  assert.equal(conclusion([]), '');
  assert.equal(conclusion([run('completed', 'success'), run('in_progress')]), 'running');
  assert.equal(conclusion([run('completed', 'success'), run('completed', 'skipped')]), 'success');
  assert.equal(conclusion([run('completed', 'success'), run('completed', 'failure')]), 'failure');
  assert.equal(conclusion([run('completed', 'cancelled'), run('completed', 'success')]), 'cancelled');
});

test('stream keeps the user\'s CLAUDE_* setup and drops only the parent session\'s variables', () => {
  assert.deepEqual(SESSION_ENV, ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT']);
});

test('stream starts the claude on PATH and its output reaches the log files (T-71: detached cmd.exe wrote nothing)', async () => {
  const { root, home } = multiDesk(), bin = join(root, 'bin');
  mkdirSync(bin);
  // A stand-in claude: node itself rejects claude's options with a message on stderr, which proves it ran.
  const fake = join(bin, process.platform === 'win32' ? 'claude.exe' : 'claude');
  copyFileSync(process.execPath, fake);
  writeFileSync(join(home, 'task.md'), 'Do the thing.\n');
  const e = env(home), pathKey = Object.keys(e).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const r = spawnSync(process.execPath, [BIN, 'stream', 'side', 'task.md', '--repo', 'a'], { cwd: home, encoding: 'utf8', env: { ...e, [pathKey]: `${bin}${delimiter}${e[pathKey]}` } });
  ok(r);
  const out = join(home, 'scratch', 'side-run.jsonl');
  for (let i = 0; i < 100 && !(statSync(out).size || statSync(`${out}.err`).size); i++) await new Promise((res) => setTimeout(res, 100));
  assert.ok(statSync(out).size || statSync(`${out}.err`).size, 'the claude process wrote nothing to the log or err file');
});

test('stream budget: --budget or front matter budgetUsd becomes --max-budget-usd, default none', () => {
  const { home } = multiDesk();
  const dry = (...a) => ok(desk(home, 'stream', 'side', 'task.md', '--repo', 'a', '--dry-run', ...a));
  writeFileSync(join(home, 'task.md'), 'Do the thing.\n');
  assert.doesNotMatch(dry(), /max-budget/);
  assert.match(dry('--budget', '2.5'), /^claude -p .* --max-budget-usd 2\.5 </);
  writeFileSync(join(home, 'task.md'), '---\nbudgetUsd: 4\n---\nDo the thing.\n');
  const out = dry();
  assert.match(out, /--max-budget-usd 4 </);
  assert.doesNotMatch(out, /budgetUsd/, 'front matter stays out of the brief');
  assert.match(out, /Do the thing\./);
  assert.match(dry('--budget', '1'), /--max-budget-usd 1 </);
  fails(desk(home, 'stream', 'side', 'task.md', '--repo', 'a', '--dry-run', '--budget', 'lots'), /budget must be/);
});

test('stream --dry-run writes the brief and prints the claude command', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'task.md'), 'Do the thing.\n');
  const out = ok(desk(home, 'stream', 'side', 'task.md', '--repo', 'a', '--todo', 'T-7', '--dry-run'));
  assert.match(out, /^claude -p --max-turns 80 /);
  assert.match(out, /Your slug is `side` \(repo a, worktree /);
  assert.match(out, /desk todo start T-7 --slug side/);
  assert.match(readFileSync(join(home, 'scratch', 'side-prompt.txt'), 'utf8'), /Do the thing\./);
  fails(desk(home, 'stream', 'Bad Slug', 'task.md', '--dry-run'), /slug must be/);
});

test('wt and stream reject an unknown flag and a value flag without its value', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'task.md'), 'x\n');
  fails(desk(home, 'wt', 'new', 'x', '--bogus'), /unknown flag --bogus/);
  fails(desk(home, 'wt', 'new', 'x', '--repo'), /--repo needs a value/);
  fails(desk(home, 'wt', 'new', 'x', '--repo', '--no-build'), /--repo needs a value/);
  fails(desk(home, 'stream', 'x', 'task.md', '--budget'), /--budget needs a value/);
  fails(desk(home, 'stream', 'x', 'task.md', '--nope'), /unknown flag --nope/);
  // Each takes only its own flags: a stream flag on wt (or the reverse) is unknown, not ignored.
  fails(desk(home, 'wt', 'discard', 'x', '--dry-run'), /unknown flag --dry-run/);
  fails(desk(home, 'wt', 'new', 'x', '--budget', '5'), /unknown flag --budget/);
  fails(desk(home, 'stream', 'x', 'task.md', '--rebased'), /unknown flag --rebased/);
});

test('wt finish: a push rejected after an amend says to rerun with --rebased, which works', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'a-amend');
  ok(desk(home, 'wt', 'new', 'amend', '--repo', 'a'));
  commit(wt, 'f.txt', 'one\n');
  ok(desk(home, 'wt', 'finish', 'amend'));
  git(wt, 'commit', '-q', '--amend', '-m', 'amended');
  fails(desk(home, 'wt', 'finish', 'amend'), /rerun with --rebased/);
  ok(desk(home, 'wt', 'finish', 'amend', '--rebased'));
});

// A pushed, reviewed worktree `stuck` ready for `wt merge`.
function mergeReady() {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'a-stuck');
  ok(desk(home, 'wt', 'new', 'stuck', '--repo', 'a'));
  const sha = commit(wt, 'sub/f.txt', 'x\n');
  ok(desk(home, 'wt', 'finish', 'stuck'));
  ok(desk(home, 'board', 'post', 'verdict', 'stuck', `MERGE @${sha}`));
  return { root, home, wt, sha };
}

test('wt merge: a worktree git refuses to remove (locked) keeps the worktree and the claim, exit 1', () => {
  const { root, home, wt, sha } = mergeReady();
  git(join(root, 'a'), 'worktree', 'lock', wt); // git refuses before deleting anything, as with modified files
  const r = desk(home, 'wt', 'merge', 'stuck');
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /locked/, "git's reason is shown");
  assert.match(r.stderr, /git worktree remove failed.*desk wt remove stuck/);
  assert.equal(git(join(root, 'a.git'), 'rev-parse', 'main'), sha, 'the merge was pushed');
  assert.ok(existsSync(join(wt, '.git')), 'worktree kept');
  assert.equal(board(home).at(-1).kind, 'merged', 'no release: the claim stays');
});

test('wt merge: a folder that cannot be deleted after git unregistered it closes the merge, warning and exit 0', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  const { root, home, wt, sha } = mergeReady();
  chmodSync(join(wt, 'sub'), 0o555); // git unregisters the worktree, then fails to delete sub/f.txt
  try {
    const r = desk(home, 'wt', 'merge', 'stuck');
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stderr, /could not be removed/);
    assert.ok(r.stderr.includes(wt), 'names the folder to remove by hand');
    assert.equal(git(join(root, 'a.git'), 'rev-parse', 'main'), sha, 'the merge was pushed');
    assert.equal(git(join(root, 'a'), 'branch', '--list', 'agent/stuck'), '', 'branch deleted');
    assert.deepEqual(board(home).slice(-2).map((l) => l.kind), ['merged', 'release']);
  } finally { chmodSync(join(wt, 'sub'), 0o755); }
});

test('wt discard: a worktree git refuses to remove (locked) keeps branch and claim, exit 1', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'b-lk');
  ok(desk(home, 'wt', 'new', 'lk', '--repo', 'b'));
  git(join(root, 'b'), 'worktree', 'lock', wt);
  const r = desk(home, 'wt', 'discard', 'lk');
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /branch and claim kept/);
  assert.ok(existsSync(join(wt, '.git')), 'worktree kept');
  assert.match(git(join(root, 'b'), 'branch', '--list', 'agent/lk'), /agent\/lk/);
  assert.equal(board(home).at(-1).kind, 'claim', 'no release: the claim stays');
});

test('wt discard: a folder that cannot be deleted after git unregistered it finishes with a warning, exit 0', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'b-fl');
  ok(desk(home, 'wt', 'new', 'fl', '--repo', 'b'));
  commit(wt, 'sub/f.txt', 'x\n');
  chmodSync(join(wt, 'sub'), 0o555);
  try {
    const r = desk(home, 'wt', 'discard', 'fl');
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stderr, /could not be removed/);
    assert.equal(git(join(root, 'b'), 'branch', '--list', 'agent/fl'), '', 'branch deleted');
    assert.deepEqual([board(home).at(-1).kind, board(home).at(-1).text], ['release', 'discarded']);
  } finally { chmodSync(join(wt, 'sub'), 0o755); }
});

// A merged branch whose worktree is still there: the merge ran with the worktree locked.
function mergedLeft() {
  const m = mergeReady();
  git(join(m.root, 'a'), 'worktree', 'lock', m.wt);
  assert.equal(desk(m.home, 'wt', 'merge', 'stuck').status, 1);
  return m;
}

test('wt remove: a worktree git refuses to remove (locked) keeps the claim, exit 1', () => {
  const { home, wt } = mergedLeft();
  const r = desk(home, 'wt', 'remove', 'stuck');
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /git worktree remove failed: fix/);
  assert.ok(existsSync(join(wt, '.git')), 'worktree kept');
  assert.equal(board(home).at(-1).kind, 'merged', 'no release: the claim stays');
});

test('wt remove: a folder that cannot be deleted after git unregistered it releases with a warning, exit 0', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  const { root, home, wt } = mergedLeft();
  git(join(root, 'a'), 'worktree', 'unlock', wt);
  chmodSync(join(wt, 'sub'), 0o555);
  try {
    const r = desk(home, 'wt', 'remove', 'stuck');
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stderr, /could not be removed/);
    assert.equal(git(join(root, 'a'), 'branch', '--list', 'agent/stuck'), '', 'branch deleted');
    assert.deepEqual([board(home).at(-1).kind, board(home).at(-1).text], ['release', 'removed; folder left']);
  } finally { chmodSync(join(wt, 'sub'), 0o755); }
});

test('status: an open branch behind origin/<default> says how far, nothing when level', () => {
  const { home, root } = multiDesk();
  ok(desk(home, 'wt', 'new', 'bh', '--repo', 'a'));
  assert.doesNotMatch(ok(desk(home, 'status')), /behind/);
  commit(join(root, 'a'), 'one.txt', '1'); commit(join(root, 'a'), 'two.txt', '2');
  git(join(root, 'a'), 'push', '-q', 'origin', 'main'); // updates origin/main in the shared refs
  assert.match(ok(desk(home, 'status')), /- bh @\w{7}: .*; behind main by 2, rebase\n/);
});

test('status: a branch in a repo without origin counts behind the local default branch', () => {
  const { home, root } = multiDesk();
  ok(desk(home, 'wt', 'new', 'nb', '--repo', 'b'));
  commit(join(root, 'b'), 'one.txt', '1');
  assert.match(ok(desk(home, 'status')), /- nb @\w{7}: .*; behind main by 1, rebase\n/);
});

test('watchRuns gives each watch only the time left of the bound', () => {
  const seen = [];
  const fake = (_cmd, _args, opts) => { seen.push(opts.timeout); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120); };
  watchRuns({ gh: 'o/r' }, [1, 2, 3], 200, fake);
  assert.equal(seen.length, 2);
  assert.ok(seen[0] <= 200 && seen[1] < seen[0], String(seen));
});
