#!/usr/bin/env node
// Live test of the merge "review" path's gh calls, on the private repo only: `node scripts/gh-review-live.mjs`.
// Deliberately not named `*-test.mjs`: Node's test runner would run it for real on a bare `node --test`.
// Creates a throwaway base branch and head branch (empty commits, no checkout), then a PR between them:
// list, create, update (push + edit), merge on the server, close proof, checking the state each time. The PR
// targets the throwaway base, never `develop`. An open PR is closed and both branches deleted in `finally`, even on failure.
// "[skip ci]" is in the three commit messages and the PR title (the squash commit takes its message from the
// title): each run would otherwise queue 12 CI jobs on the owner's one runner.
// shortcut: the gh/git arguments below copy lib/wt.mjs (`gh`/`ghBody`, `prsFor`, the close proof, the body on
// stdin); they can drift, so re-read those functions when wt.mjs changes.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from '../lib/config.mjs';

// cwd is this repo's root, never the caller's: git here must not branch or push in whichever repo the shell is in.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const sh = (cmd, args, input) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 60e3 }).trim();

export function liveTest(run = sh, id = Date.now(), root = ROOT) {
  // A plain install has no .git here, so git would walk up into whatever repo holds node_modules.
  if (!existsSync(join(root, '.git'))) throw new Error(`refusing: ${root} is not a git checkout`);
  // The push URL: that is where this script pushes. `git push origin` pushes to every push URL, so exactly one.
  const urls = run('git', ['remote', 'get-url', '--push', '--all', 'origin']).split('\n').map((u) => u.trim()).filter(Boolean);
  if (urls.length !== 1) throw new Error(`refusing: origin has ${urls.length} push URLs`);
  const origin = urls[0];
  const info = JSON.parse(run('gh', ['repo', 'view', origin, '--json', 'nameWithOwner,isPrivate']));
  if (!info.isPrivate) throw new Error(`refusing: ${info.nameWithOwner} is not private`);
  const repo = info.nameWithOwner;
  const base = `agent/gh-live-base-${id}`, head = `agent/gh-live-head-${id}`;
  const log = [];
  const ok = (msg) => log.push(msg);
  const must = (cond, msg) => { if (!cond) throw new Error(msg); ok(msg); };
  const gh = (a, input) => run('gh', ['-R', repo, ...a], input);
  const list = () => JSON.parse(gh(['pr', 'list', '--head', head, '--state', 'all', '--json', 'number,state,headRefOid,url,isCrossRepository']));
  // A branch that is already gone (the server may delete the head on merge) is deleted, not an error.
  const del = (b) => { try { run('git', ['push', 'origin', '--delete', b]); } catch (e) { if (!/remote ref does not exist/.test(`${e.stderr ?? ''}${e.message}`)) throw e; } };
  let num;
  const pushed = [];
  try {
    run('git', ['fetch', 'origin', 'develop']);
    const dev = run('git', ['rev-parse', 'origin/develop']);
    const c1 = run('git', ['commit-tree', `${dev}^{tree}`, '-p', dev, '-m', 'gh live test: base [skip ci]']);
    pushed.push(base);
    run('git', ['push', 'origin', `${c1}:refs/heads/${base}`]);
    const c2 = run('git', ['commit-tree', `${c1}^{tree}`, '-p', c1, '-m', 'gh live test: head [skip ci]']);
    pushed.push(head);
    run('git', ['push', 'origin', `${c2}:refs/heads/${head}`]);
    must(list().length === 0, 'no PR for the head yet');

    const url = gh(['pr', 'create', '--base', base, '--head', head, '--title', `gh live test ${id} (throwaway) [skip ci]`, '--body-file', '-'], 'one');
    num = /\/pull\/(\d+)/.exec(url)?.[1];
    must(num, `created PR #${num}`);
    const [p] = list();
    must(p?.state === 'OPEN' && p.headRefOid === c2 && String(p.number) === num, 'PR open at the pushed head');

    const c3 = run('git', ['commit-tree', `${c2}^{tree}`, '-p', c2, '-m', 'gh live test: update [skip ci]']);
    run('git', ['push', 'origin', `${c3}:refs/heads/${head}`]);
    gh(['pr', 'edit', num, '--body-file', '-'], 'two');
    must(list()[0]?.headRefOid === c3, 'PR follows the new head');
    must(JSON.parse(gh(['pr', 'view', num, '--json', 'body'])).body === 'two', 'PR follows the new body');

    gh(['pr', 'merge', num, '--squash']);
    must(list()[0]?.state === 'MERGED', 'PR merged on the server');

    // The close proof of lib/wt.mjs: the head branch is gone, pull/<n>/head still holds the commits.
    del(head);
    run('git', ['fetch', '-q', 'origin', `pull/${num}/head`]);
    let held = true;
    try { run('git', ['merge-base', '--is-ancestor', c3, 'FETCH_HEAD']); } catch { held = false; }
    must(held, 'merged head is an ancestor of pull/<n>/head (close proof)');
  } finally {
    // best effort: every step runs, failures are reported not thrown
    let state;
    if (num) try { state = JSON.parse(gh(['pr', 'view', num, '--json', 'state'])).state; } catch { /* unknown: leave it */ }
    const undo = [];
    if (state === 'OPEN') undo.push(['pr close', () => gh(['pr', 'close', num])]);
    for (const b of pushed) undo.push([`delete ${b}`, () => del(b)]);
    for (const [name, fn] of undo) try { fn(); ok(`cleanup: ${name}`); } catch (e) { console.error(`cleanup FAILED: ${name}: ${e.message}`); process.exitCode = 1; }
  }
  return log;
}

if (isMain(import.meta.url)) {
  try { console.log(liveTest().join('\n')); if (!process.exitCode) console.log('ok'); } catch (e) { console.error(`FAILED: ${e.message}`); process.exitCode = 1; }
}
