import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, copyFileSync, statSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, delimiter } from 'node:path';
import { multiDesk, desk, git, commit, env, BIN, ok, board, setRepo } from './helpers.mjs';
import { watchRuns, SESSION_ENV } from '../lib/wt.mjs';
import { conclusion } from '../bin/desk.mjs';

const fails = (r, re) => { assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, re); };

test('wt new -> finish -> merge gate -> merge, no gh (no CI)', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'a-demo');

  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a'));
  assert.equal(git(wt, 'branch', '--show-current'), 'agent/demo');
  assert.equal(spawnSync('git', ['-C', wt, 'rev-parse', '--abbrev-ref', '@{upstream}']).status, 128, 'no upstream: a bare git push cannot land on main');
  assert.equal(JSON.parse(readFileSync(join(wt, '.claude', 'settings.local.json'), 'utf8')).env.DESK_HOME, home);
  assert.equal(git(wt, 'status', '--porcelain'), '', 'synced settings must not dirty the worktree');
  assert.deepEqual(board(home).at(-1), { ...board(home).at(-1), kind: 'claim', slug: 'demo', repo: 'a', from: 'testsess' });
  assert.match(readFileSync(join(home, 'desk.code-workspace'), 'utf8'), /wt demo \(a\)/);
  fails(desk(home, 'wt', 'new', 'demo', '--repo', 'b'), /already open in repo a/);

  ok(desk(home, 'todo', 'add', 'demo work', '--area', 'a'));
  ok(desk(home, 'todo', 'start', 'T-1', '--slug', 'demo'));
  ok(desk(home, 'todo', 'split', 'T-1', 'step one', 'step two')); // T-2, T-3: steps of the change
  ok(desk(home, 'todo', 'add', 'follow-up', '--area', 'a', '--slug', 'demo')); // T-4: tagged, not started
  ok(desk(home, 'todo', 'add', 'blocked work', '--area', 'a'));
  ok(desk(home, 'todo', 'start', 'T-5', '--slug', 'demo'));
  ok(desk(home, 'todo', 'block', 'T-5')); // T-5: started for the slug, then blocked
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
  const status = (id) => JSON.parse(ok(desk(home, 'todo', 'show', id))).status;
  assert.deepEqual(['T-1', 'T-2', 'T-3', 'T-4', 'T-5'].map(status), ['done', 'done', 'done', 'open', 'done'],
    'the active todo and its steps close, a started-then-blocked todo closes too; a tagged open todo stays');
  assert.match(JSON.parse(ok(desk(home, 'todo', 'show', 'T-5'))).notes.at(-1), /: merged \(demo\)$/);
});

test('status --fetch reads commits others pushed; plain status stays on local refs; a branch line carries its state', () => {
  const { root, home } = multiDesk();
  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a', '--no-build'));
  const other = join(root, 'other');
  git(root, 'clone', '-q', join(root, 'a.git'), other);
  commit(other, 'src/theirs.txt', 'x\n');
  git(other, 'push', '-q', 'origin', 'HEAD:main');
  const behind = (...a) => JSON.parse(ok(desk(home, 'status', '--json', ...a))).branches.find((b) => b.slug === 'demo').behind;
  assert.equal(behind(), null, 'no fetch: local refs only');
  assert.deepEqual(behind('--fetch'), { base: 'main', n: 1 });
  assert.match(ok(desk(home, 'status')), /- demo @[0-9a-f]{7}: .*verdict: none \[rebase\]/);
  assert.match(ok(desk(home, 'status')), /- a: git, .*main @[0-9a-f]{7}; no check command, wt finish checks nothing/);
});

test('wt handoff writes the active todo\'s state from facts, drops the verdict\'s by part, and releases the claim', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'a-demo');
  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a', '--no-build'));
  ok(desk(home, 'todo', 'add', 'demo work', '--area', 'a'));
  ok(desk(home, 'todo', 'start', 'T-1', '--slug', 'demo'));
  fails(desk(home, 'wt', 'handoff', 'demo'), /needs --next/);
  const head = commit(wt, 'src/one.txt', 'one\n');
  ok(desk(home, 'board', 'post', 'verdict', 'demo', `FIXES NEEDED @${head.slice(0, 7)} by opus/high`));
  writeFileSync(join(wt, 'wip.txt'), 'x');
  ok(desk(home, 'wt', 'handoff', 'demo', '--next', 'fix finding 2, then wt finish; sonnet/medium'));
  const t = JSON.parse(ok(desk(home, 'todo', 'show', 'T-1')));
  assert.equal(t.state, `head ${head.slice(0, 7)}, uncommitted changes, not pushed, CI no CI, verdict FIXES NEEDED @${head.slice(0, 7)}`);
  assert.equal(t.next, 'fix finding 2, then wt finish; sonnet/medium');
  assert.deepEqual([board(home).at(-1).kind, board(home).at(-1).text], ['release', 'handed off']);
  appendFileSync(join(home, 'board.jsonl'), JSON.stringify({ v: 1, ts: new Date().toISOString(), from: 'otherses', kind: 'claim', slug: 'demo', repo: 'a' }) + '\n');
  fails(desk(home, 'wt', 'handoff', 'demo', '--next', 'x'), /claimed by session otherses/);
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
  // A second run for the slug appends: it must not wipe a live run's log.
  const before = statSync(out).size + statSync(`${out}.err`).size;
  ok(spawnSync(process.execPath, [BIN, 'stream', 'side', 'task.md', '--repo', 'a'], { cwd: home, encoding: 'utf8', env: { ...e, [pathKey]: `${bin}${delimiter}${e[pathKey]}` } }));
  for (let i = 0; i < 100 && statSync(out).size + statSync(`${out}.err`).size <= before; i++) await new Promise((res) => setTimeout(res, 100));
  assert.ok(statSync(out).size + statSync(`${out}.err`).size > before, 'the second run appended');
});

test('stream brief: a merge:review repo asks for the PR findings in the final message, others do not', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'task.md'), 'Do the thing.\n');
  const dry = () => ok(desk(home, 'stream', 'side', 'task.md', '--repo', 'a', '--dry-run'));
  assert.doesNotMatch(dry(), /PR findings/);
  setRepo(home, 'a', { merge: 'review' });
  assert.match(dry(), /final message also holds the `PR findings:` block of the last reviewer or verifier report \(the verifier's after a fix round\)/);
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

test('stream refuses before starting: a missing or closed todo, a typed todo with no claim, a slug another session holds', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'task.md'), 'Do the thing.\n');
  const dry = (...a) => desk(home, 'stream', 'side', 'task.md', '--repo', 'a', '--dry-run', ...a);
  fails(dry('--todo', 'T-9'), /T-9 does not exist; nothing was started/);
  ok(desk(home, 'todo', 'add', 'typed', '--area', 'a', '--kind', 'fix'));
  fails(dry('--todo', 'T-1'), /T-1 is a fix with no acceptance claim/);
  fails(desk(home, 'todo', 'start', 'T-1'), /no acceptance claim/);
  ok(desk(home, 'todo', 'note', 'T-1', 'accept: repro passes | npm test | exit 0'));
  ok(dry('--todo', 'T-1'));
  ok(desk(home, 'todo', 'done', 'T-1'));
  fails(dry('--todo', 'T-1'), /T-1 is done/);
  fails(desk(home, 'todo', 'add', 'bad kind', '--area', 'a', '--kind', 'chore'), /--kind is one of/);
  ok(desk(home, 'wt', 'new', 'side', '--repo', 'a', '--no-build'));
  appendFileSync(join(home, 'board.jsonl'), JSON.stringify({ v: 1, ts: new Date().toISOString(), from: 'otherses', kind: 'claim', slug: 'side', repo: 'a' }) + '\n');
  fails(dry(), /claimed by session otherses; nothing was started/);
});

test('stream --dry-run writes the brief and prints the claude command', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'task.md'), 'Do the thing.\n');
  for (let i = 0; i < 7; i++) ok(desk(home, 'todo', 'add', `todo ${i + 1}`, '--area', 'a'));
  const out = ok(desk(home, 'stream', 'side', 'task.md', '--repo', 'a', '--todo', 'T-7', '--dry-run'));
  assert.match(out, /^claude -p --max-turns 80 /);
  assert.match(out, /Your slug is `side` \(repo a, worktree /);
  assert.match(out, /desk todo start T-7 --slug side/);
  assert.match(readFileSync(join(home, 'scratch', 'side-prompt.txt'), 'utf8'), /Do the thing\./);
  fails(desk(home, 'stream', 'Bad Slug', 'task.md', '--dry-run'), /slug must be/);
});

test('wt new copies the repo\'s copy paths from the main checkout, skips a missing one, refuses an escaping one', () => {
  const { root, home } = multiDesk();
  const cfgFile = join(home, 'desk.config.json');
  const cfg = JSON.parse(readFileSync(cfgFile, 'utf8'));
  const setCopy = (copy) => { cfg.repos.find((r) => r.id === 'a').copy = copy; writeFileSync(cfgFile, JSON.stringify(cfg)); };
  cfg.repos.find((r) => r.id === 'a').install = `node -e "process.exit(require('fs').existsSync('types/sub/x.d.ts')?0:1)"`; // copy must run before install
  mkdirSync(join(root, 'a', 'types', 'sub'), { recursive: true });
  writeFileSync(join(root, 'a', 'types', 'sub', 'x.d.ts'), 'declare const x: 1\n');

  setCopy(['types', 'absent/file.txt']);
  const made = ok(desk(home, 'wt', 'new', 'cp', '--repo', 'a'));
  assert.match(made, /copy: absent\/file\.txt not in .*, skipped/);
  assert.equal(readFileSync(join(root, 'worktrees', 'a-cp', 'types', 'sub', 'x.d.ts'), 'utf8'), 'declare const x: 1\n');
  assert.equal(existsSync(join(root, 'worktrees', 'a-cp', 'absent')), false);

  setCopy(['../outside']);
  fails(desk(home, 'wt', 'new', 'esc', '--repo', 'a'), /copy path must be relative/);
  assert.equal(existsSync(join(root, 'worktrees', 'a-esc')), false);
  for (const bad of [[join(root, 'abs')], ['.'], [''], '.env']) {
    setCopy(bad);
    fails(desk(home, 'wt', 'new', 'esc', '--repo', 'a'), /copy (path must be relative|must be an array)/);
  }
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

test('wt finish: a fresh worktree over an old remote branch is told the way out, and --rebased never overwrites it', () => {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'a-stale');
  ok(desk(home, 'wt', 'new', 'stale', '--repo', 'a'));
  commit(wt, 'f.txt', 'old\n');
  ok(desk(home, 'wt', 'finish', 'stale'));
  ok(desk(home, 'wt', 'discard', 'stale')); // the remote branch stays
  ok(desk(home, 'wt', 'new', 'stale', '--repo', 'a'));
  commit(wt, 'g.txt', 'new\n');
  const way = /git rebase origin\/agent\/stale.*git push origin --delete agent\/stale/s;
  fails(desk(home, 'wt', 'finish', 'stale'), way);
  fails(desk(home, 'wt', 'finish', 'stale', '--rebased'), way); // still refused: the remote commit is unseen
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

test('wt merge: a rejected push leaves the default branch unmoved; a rerun after origin moved says to rebase, not a local divergence', () => {
  const { root, home, wt } = mergeReady();
  ok(desk(home, 'todo', 'add', 'w', '--area', 'a')); ok(desk(home, 'todo', 'start', 'T-1', '--slug', 'stuck'));
  const main = join(root, 'a'), hook = join(main, '.git', 'hooks', 'pre-push'), before = git(main, 'rev-parse', 'main');
  writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fails(desk(home, 'wt', 'merge', 'stuck'), /git push origin main failed; the default branch was not moved past origin/);
  assert.equal(git(main, 'rev-parse', 'main'), before, 'local default branch not moved');
  assert.ok(existsSync(join(wt, '.git')), 'worktree kept');
  assert.ok(!board(home).some((l) => l.kind === 'merged'), 'no merged line');
  assert.equal(JSON.parse(ok(desk(home, 'todo', 'show', 'T-1'))).status, 'active', 'todo not closed');
  rmSync(hook);
  const other = join(root, 'other'); git(root, 'clone', '-q', join(root, 'a.git'), other);
  commit(other, 'other.txt', 'o\n'); git(other, 'push', '-q', 'origin', 'main');
  fails(desk(home, 'wt', 'merge', 'stuck'), /not a fast-forward of main; run desk wt rebase stuck/);
  assert.equal(git(main, 'branch', '--show-current'), 'main');
  assert.equal(git(main, 'rev-parse', 'main'), git(join(root, 'a.git'), 'rev-parse', 'main'), 'local caught up to origin, no divergence');
  assert.ok(existsSync(join(wt, '.git')), 'worktree kept');
});

test('wt merge: a sha origin already holds (a rerun after a failed local step) skips the push and still closes the work', () => {
  const { root, home, wt, sha } = mergeReady();
  git(wt, 'push', '-q', 'origin', `${sha}:refs/heads/main`); // landed on origin, local main still behind
  ok(desk(home, 'wt', 'merge', 'stuck'));
  assert.equal(git(join(root, 'a'), 'rev-parse', 'main'), sha);
  assert.ok(!existsSync(join(wt, '.git')), 'worktree removed');
  assert.deepEqual(board(home).slice(-2).map((l) => l.kind), ['merged', 'release']);
});

test('wt merge: a rerun closes work already on origin after origin moved on', () => {
  const { root, home, wt, sha } = mergeReady();
  git(wt, 'push', '-q', 'origin', `${sha}:refs/heads/main`);
  const other = join(root, 'other'); git(root, 'clone', '-q', join(root, 'a.git'), other);
  commit(other, 'other.txt', 'o\n'); git(other, 'push', '-q', 'origin', 'main');
  ok(desk(home, 'wt', 'merge', 'stuck'));
  assert.ok(!existsSync(join(wt, '.git')), 'worktree removed');
  assert.deepEqual(board(home).slice(-2).map((l) => l.kind), ['merged', 'release']);
});

test('wt merge: pushed but the local step failed keeps the worktree; a rerun closes the work', () => {
  const { root, home, wt, sha } = mergeReady();
  const main = join(root, 'a'), hook = join(main, '.git', 'hooks', 'pre-push'), lock = join(main, '.git', 'index.lock');
  writeFileSync(hook, `#!/bin/sh
touch '${lock}'
exit 0
`, { mode: 0o755 });
  fails(desk(home, 'wt', 'merge', 'stuck'), /is pushed to origin/);
  assert.equal(git(join(root, 'a.git'), 'rev-parse', 'main'), sha, 'pushed');
  assert.ok(!board(home).some((l) => l.kind === 'merged'), 'no merged line');
  assert.ok(existsSync(join(wt, '.git')), 'worktree kept');
  rmSync(lock); rmSync(hook);
  ok(desk(home, 'wt', 'merge', 'stuck'));
  assert.ok(!existsSync(join(wt, '.git')), 'worktree removed');
  assert.deepEqual(board(home).slice(-2).map((l) => l.kind), ['merged', 'release']);
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
  // A fake clock: each watch takes 120 ms of it, so the test does not depend on how busy the runner is.
  const seen = [];
  let t = 0;
  const fake = (_cmd, _args, opts) => { seen.push(opts.timeout); t += 120; };
  watchRuns({ gh: 'o/r' }, [1, 2, 3], 200, fake, () => t);
  assert.deepEqual(seen, [200, 80], 'the second watch gets only what is left; the third none');
});

// A worktree `rb` with one commit editing line N of a 10-line f.txt, reviewed at that commit, then
// origin/main moves on: ['g'] adds an unrelated file, [n, text] edits line n of f.txt.
function rebaseFixture(branchEdit, mainEdit, verdict = true) {
  const { root, home } = multiDesk();
  const wt = join(root, 'worktrees', 'a-rb'), main = join(root, 'a');
  const put = (n, v) => Array.from({ length: 10 }, (_, i) => (i + 1 === n ? v : `l${i + 1}`)).join('\n') + '\n';
  commit(main, 'f.txt', put(0, '')); git(main, 'push', '-q', 'origin', 'main');
  ok(desk(home, 'wt', 'new', 'rb', '--repo', 'a'));
  const reviewed = commit(wt, 'f.txt', put(...branchEdit));
  ok(desk(home, 'wt', 'finish', 'rb'));
  if (verdict) ok(desk(home, 'board', 'post', 'verdict', 'rb', `MERGE @${reviewed.slice(0, 7)}`));
  if (mainEdit[0] === 'g') commit(main, 'g.txt', 'g\n'); else commit(main, 'f.txt', put(...mainEdit));
  git(main, 'push', '-q', 'origin', 'main');
  return { root, home, wt, reviewed };
}

test('wt rebase: only context changed reports the same patches, pushes, posts no verdict', () => {
  const { root, home, wt, reviewed } = rebaseFixture([8, 'B8'], ['g']);
  const out = ok(desk(home, 'wt', 'rebase', 'rb'));
  const head = git(wt, 'rev-parse', 'HEAD');
  assert.notEqual(head, reviewed);
  assert.match(out, /Only context changed/);
  assert.match(out, new RegExp(`Reviewed commit \\(newest board verdict MERGE\\): ${reviewed.slice(0, 7)}`));
  assert.ok(out.includes(`New head ${head}`) && out.includes(`Old head ${reviewed}`));
  assert.equal(git(join(root, 'a.git'), 'rev-parse', 'agent/rb'), head, 'pushed with force-with-lease');
  assert.equal(board(home).at(-1).kind, 'verdict', 'no verdict posted');
  fails(desk(home, 'wt', 'merge', 'rb'), /commits after the review/);
});

test('wt rebase: a patch whose context changed is reported as different', () => {
  const { home } = rebaseFixture([6, 'B6'], [4, 'M4']);
  const out = ok(desk(home, 'wt', 'rebase', 'rb'));
  assert.match(out, /Patches differ from the reviewed commit:\n\s+1:\s+\w+ ! 1:/);
  assert.doesNotMatch(out, /Only context changed/);
});

test('wt rebase: a conflict aborts the rebase and leaves the worktree at its old head', () => {
  const { home, wt, reviewed } = rebaseFixture([6, 'B6'], [6, 'M6']);
  fails(desk(home, 'wt', 'rebase', 'rb'), /conflicts; aborted/);
  assert.equal(git(wt, 'rev-parse', 'HEAD'), reviewed);
  assert.equal(git(wt, 'status', '--porcelain'), '');
  assert.equal(git(wt, 'branch', '--show-current'), 'agent/rb', 'no rebase in progress');
});

test('wt rebase refuses a dirty worktree', () => {
  const { home, wt } = rebaseFixture([8, 'B8'], ['g']);
  writeFileSync(join(wt, 'dirty.txt'), 'x');
  fails(desk(home, 'wt', 'rebase', 'rb'), /uncommitted changes/);
});

test('wt rebase: with no verdict it compares with the head before the rebase and says so', () => {
  const { home, reviewed } = rebaseFixture([8, 'B8'], ['g'], false);
  const out = ok(desk(home, 'wt', 'rebase', 'rb'));
  assert.match(out, new RegExp(`No usable board verdict; compared with the head before the rebase: ${reviewed.slice(0, 7)}`));
  assert.match(out, /Only context changed/);
});

test('wt rebase: a commit pushed to the branch from elsewhere is not overwritten', () => {
  const { root, home } = rebaseFixture([8, 'B8'], ['g']);
  const bare = join(root, 'a.git'), other = join(root, 'other');
  git(root, 'clone', '-q', bare, other);
  git(other, 'checkout', '-q', 'agent/rb');
  const theirs = commit(other, 'theirs.txt', 't\n');
  git(other, 'push', '-q', 'origin', 'agent/rb');
  assert.notEqual(desk(home, 'wt', 'rebase', 'rb').status, 0);
  assert.equal(git(bare, 'rev-parse', 'agent/rb'), theirs, 'their commit is still on origin');
});

test('wt rebase: a patch whose subject contains " = " still counts as changed', () => {
  const { home, wt } = rebaseFixture([6, 'B6'], [4, 'M4']); // the patch differs after the rebase
  git(wt, 'commit', '--amend', '-q', '-m', 'set x = 1'); // range-diff prints the reviewed commit's subject
  ok(desk(home, 'wt', 'finish', 'rb', '--rebased'));
  ok(desk(home, 'board', 'post', 'verdict', 'rb', `MERGE @${git(wt, 'rev-parse', 'HEAD')}`));
  const out = ok(desk(home, 'wt', 'rebase', 'rb'));
  assert.match(out, /Patches differ/);
  assert.doesNotMatch(out, /Only context changed/);
});

test('wt rebase: already rebased but not pushed still pushes; once pushed it pushes nothing', () => {
  const { root, home, wt } = rebaseFixture([8, 'B8'], ['g']);
  git(wt, 'rebase', '-q', 'origin/main');
  const head = git(wt, 'rev-parse', 'HEAD'), bare = join(root, 'a.git');
  assert.notEqual(git(bare, 'rev-parse', 'agent/rb'), head);
  ok(desk(home, 'wt', 'rebase', 'rb'));
  assert.equal(git(bare, 'rev-parse', 'agent/rb'), head, 'pushed');
  assert.match(ok(desk(home, 'wt', 'rebase', 'rb')), /Already up to date: nothing to push/);
});

test('wt rebase: a verdict sha not in this repo is named, a FIXES NEEDED verdict is shown as such', () => {
  const { home } = rebaseFixture([8, 'B8'], ['g'], false);
  ok(desk(home, 'board', 'post', 'verdict', 'rb', 'MERGE @deadbeef'));
  assert.match(ok(desk(home, 'wt', 'rebase', 'rb')), /No usable board verdict \(deadbeef is not in this repo\)/);
  const f = rebaseFixture([8, 'B8'], ['g'], false);
  ok(desk(f.home, 'board', 'post', 'verdict', 'rb', `FIXES NEEDED @${f.reviewed.slice(0, 7)}`));
  assert.match(ok(desk(f.home, 'wt', 'rebase', 'rb')), /newest board verdict FIXES NEEDED\): /);
});

test('wt rebase: a failing check exits non-zero and the report is still printed', () => {
  const { home } = rebaseFixture([8, 'B8'], ['g']);
  const p = join(home, 'desk.config.json'), cfg = JSON.parse(readFileSync(p, 'utf8'));
  cfg.repos[0].check = 'node -e "process.exit(1)"';
  writeFileSync(p, JSON.stringify(cfg));
  const r = desk(home, 'wt', 'rebase', 'rb');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /Only context changed/);
});

// Unmoved head that origin lacks, no verdict: reviewed == head, so the range is empty (range-diff would die).
function unmovedFixture(failCheck) {
  const f = rebaseFixture([8, 'B8'], ['g'], false);
  git(f.wt, 'rebase', '-q', 'origin/main');
  if (failCheck) {
    const p = join(f.home, 'desk.config.json'), cfg = JSON.parse(readFileSync(p, 'utf8'));
    cfg.repos[0].check = 'node -e "process.exit(1)"';
    writeFileSync(p, JSON.stringify(cfg));
  }
  return f;
}

test('wt rebase: an empty range skips range-diff and says the reviewed commit is unchanged', () => {
  const { home } = unmovedFixture(false);
  const out = ok(desk(home, 'wt', 'rebase', 'rb'));
  assert.match(out, /unchanged, with 0 commits on top/);
  assert.doesNotMatch(out, /range-diff failed|Only context changed/);
});

test('wt rebase: a failing check still exits non-zero when the comparison is skipped', () => {
  const { home } = unmovedFixture(true);
  const r = desk(home, 'wt', 'rebase', 'rb');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /unchanged, with 0 commits on top/);
});

test('wt rebase: a short verdict sha at the head or an ancestor also skips range-diff', () => {
  const { home, wt } = unmovedFixture(false);
  const short = git(wt, 'rev-parse', 'HEAD').slice(0, 7);
  ok(desk(home, 'board', 'post', 'verdict', 'rb', `MERGE @${short}`));
  assert.match(ok(desk(home, 'wt', 'rebase', 'rb')), /unchanged, with 0 commits on top/);
  commit(wt, 'fix.txt', 'fix\n');
  ok(desk(home, 'board', 'post', 'verdict', 'rb', `FIXES NEEDED @${short}`));
  const out = ok(desk(home, 'wt', 'rebase', 'rb'));
  assert.match(out, /unchanged, with 1 commit on top/);
  assert.doesNotMatch(out, /range-diff failed/);
});

test('wt rebase: a failing range-diff prints one line, and a failing check still exits non-zero', () => {
  const { home, wt } = unmovedFixture(true);
  const orphan = git(wt, 'commit-tree', '-m', 'orphan', git(wt, 'rev-parse', 'HEAD^{tree}')); // exists, shares no history: merge-base fails
  ok(desk(home, 'board', 'post', 'verdict', 'rb', `MERGE @${orphan}`));
  const r = desk(home, 'wt', 'rebase', 'rb');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /^range-diff failed: \S.*$/m);
  assert.doesNotMatch(r.stdout, /usage:/);
});
