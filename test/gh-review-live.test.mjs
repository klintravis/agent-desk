import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { realpathSync } from 'node:fs';
import { liveTest, sh } from '../scripts/gh-review-live.mjs';
import { KIT, tmp } from './helpers.mjs';

const REPO = 'owner/private-repo';

// A fake git/gh: records calls, answers the reads the script makes. Options feed wrong answers:
// failAt throws on a matching call, noMerge leaves the PR OPEN after `pr merge`, noAncestor fails the close proof,
// goneRef makes every branch delete say the ref does not exist.
function fake({ isPrivate = true, failAt, noMerge, noAncestor, goneRef, urls = [`https://github.com/${REPO}.git`] } = {}) {
  const calls = [];
  let state = null, head = '', body = '', n = 0;
  const run = (cmd, args, input) => {
    calls.push([cmd, ...args].join(' '));
    const a = args.join(' ');
    if (failAt && a.includes(failAt)) throw new Error('boom');
    if (a === 'remote get-url --push --all origin') return urls.join('\n');
    if (a.startsWith('repo view')) return JSON.stringify({ nameWithOwner: REPO, isPrivate });
    if (cmd === 'git' && args[0] === 'commit-tree') return `c${++n}`;
    if (a.startsWith('push origin c')) head = a.split(' ')[2].split(':')[0];
    if (a.startsWith('push origin --delete')) {
      if (goneRef) throw Object.assign(new Error('Command failed'), { stderr: 'error: unable to delete: remote ref does not exist' });
      return '';
    }
    if (a === 'rev-parse origin/develop') return 'dev';
    if (a.startsWith('merge-base') && noAncestor) throw new Error('not an ancestor');
    if (!a.startsWith('-R ')) return '';
    assert.ok(a.startsWith(`-R ${REPO} pr`), 'gh always targets the private repo');
    const sub = args.slice(2).join(' ');
    if (sub.startsWith('pr create')) { assert.ok(sub.endsWith('--body-file -') && input === 'one'); body = input; state = 'OPEN'; return `https://github.com/${REPO}/pull/7`; }
    if (sub.startsWith('pr edit')) { assert.ok(sub.endsWith('--body-file -') && input === 'two'); body = input; }
    if (sub.startsWith('pr merge') && !noMerge) state = 'MERGED';
    if (sub.startsWith('pr close')) state = 'CLOSED';
    if (sub.startsWith('pr list')) return JSON.stringify(state ? [{ number: 7, state, headRefOid: head, url: 'u', isCrossRepository: false }] : []);
    if (sub.startsWith('pr view')) return JSON.stringify({ state, body });
    return '';
  };
  return { run, calls };
}
const deletes = (f) => f.calls.filter((c) => c.startsWith('git push origin --delete')).length;

test('gh-review-live: refuses a public origin, touching nothing', () => {
  const f = fake({ isPrivate: false });
  assert.throws(() => liveTest(f.run, 1), /refusing/);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls[1].includes(`https://github.com/${REPO}.git`), 'gh views the push URL');
});

test('gh-review-live: refuses a folder with no .git, running nothing', () => {
  const f = fake();
  assert.throws(() => liveTest(f.run, 1, tmp()), /not a git checkout/);
  assert.equal(f.calls.length, 0);
});

test('gh-review-live: refuses an origin with two push URLs, touching nothing after the read', () => {
  const f = fake({ urls: [`https://github.com/${REPO}.git`, 'https://example.com/other.git'] });
  assert.throws(() => liveTest(f.run, 1), /refusing/);
  assert.equal(f.calls.length, 1);
});

test('gh-review-live: list, create, update, merge, close proof, then deletes both branches', () => {
  const f = fake();
  const log = liveTest(f.run, 1);
  assert.deepEqual(log, [
    'no PR for the head yet', 'created PR #7', 'PR open at the pushed head', 'PR follows the new head', 'PR follows the new body',
    'PR merged on the server', 'merged head is an ancestor of pull/<n>/head (close proof)',
    'cleanup: delete agent/gh-live-base-1', 'cleanup: delete agent/gh-live-head-1',
  ]);
  assert.ok(!f.calls.some((c) => c.includes('pr close')), 'a merged PR is not closed');
  assert.equal(deletes(f), 3); // the head once for the proof, then both in the cleanup
  assert.ok(f.calls.includes('git fetch -q origin pull/7/head'));
  assert.ok(f.calls.includes('git merge-base --is-ancestor c3 FETCH_HEAD'));
  assert.ok(f.calls.some((c) => c.startsWith(`gh -R ${REPO} pr merge 7`)));
  assert.ok(!f.calls.some((c) => /pr (merge|create).*develop|--base develop/.test(c)), 'never targets develop');
  assert.ok(f.calls.filter((c) => /commit-tree/.test(c)).every((c) => c.includes('[skip ci]')));
  assert.ok(f.calls.find((c) => c.includes('pr create')).includes('[skip ci]'));
});

test('gh-review-live: a branch the server already deleted is no failure', () => {
  const prev = process.exitCode;
  liveTest(fake({ goneRef: true }).run, 1);
  assert.equal(process.exitCode, prev);
});

test('gh-review-live: a cleanup delete that fails is reported, and the next step still runs', () => {
  const prev = process.exitCode;
  const f = fake({ failAt: '--delete agent/gh-live-base' });
  const err = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => liveTest(f.run, 1));
    assert.equal(process.exitCode, 1);
    assert.equal(deletes(f), 3);
  } finally { console.error = err; process.exitCode = prev; }
});

test('gh-review-live: a failure after the PR opens still closes it and deletes the branches', () => {
  const f = fake({ failAt: 'pr edit' });
  assert.throws(() => liveTest(f.run, 1), /boom/);
  assert.ok(f.calls.some((c) => c.startsWith(`gh -R ${REPO} pr close 7`)));
  assert.equal(deletes(f), 2);
});

test('gh-review-live: a merge the server did not do throws, closes the PR and deletes the branches', () => {
  const f = fake({ noMerge: true });
  assert.throws(() => liveTest(f.run, 1), /merged on the server/);
  assert.ok(f.calls.some((c) => c.startsWith(`gh -R ${REPO} pr close 7`)));
  assert.equal(deletes(f), 2);
});

test('gh-review-live: sh runs in the repo root, not the caller cwd', () => {
  const old = process.cwd();
  process.chdir(tmpdir()); // importing ran nothing; only this read-only git call runs
  try { assert.equal(realpathSync(sh('git', ['rev-parse', '--show-toplevel'])), realpathSync(KIT)); } finally { process.chdir(old); }
});

test('gh-review-live: a failed close proof throws, and the cleanup still runs', () => {
  const f = fake({ noAncestor: true });
  assert.throws(() => liveTest(f.run, 1), /ancestor/);
  assert.equal(deletes(f), 3); // the head once for the proof, then both in the cleanup
});
