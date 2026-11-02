import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findDesk, loadConfig, repoFor, wtDir, worktreeList, projectDirName, projectPrefixes, isDeskProject } from '../lib/config.mjs';
import { tmp } from './helpers.mjs';

const deskWith = (cfg) => { const d = tmp(); writeFileSync(join(d, 'desk.config.json'), JSON.stringify(cfg)); return d; };

test('findDesk: DESK_HOME wins, else walk up to desk.config.json, else null', () => {
  const d = deskWith({ repos: [] }), deep = join(d, 'x', 'y');
  mkdirSync(deep, { recursive: true });
  assert.equal(findDesk(deep, {}), d);
  assert.equal(findDesk('/', { DESK_HOME: d }), d);
  assert.equal(findDesk(tmp(), {}), null);
});

test('loadConfig: defaults and paths relative to the desk', () => {
  const d = deskWith({ repos: [{ id: 'app', path: '../app' }] });
  const c = loadConfig(d), r = c.repos[0];
  assert.equal(c.home, d);
  assert.equal(c.worktreesDir, join(d, '..', 'worktrees'));
  assert.equal(c.scratchDir, join(d, 'scratch'));
  assert.deepEqual(c.harnesses, ['claude']);
  assert.equal(r.path, join(d, '..', 'app'));
  assert.deepEqual([r.defaultBranch, r.branchPrefix, r.worktreePrefix, r.check], ['main', 'agent/', 'app-', '']);
});

test('loadConfig: outputStyle defaults to Concise, "" is kept, a non-string is refused', () => {
  assert.equal(loadConfig(deskWith({ repos: [] })).outputStyle, 'Concise');
  assert.equal(loadConfig(deskWith({ repos: [], outputStyle: '' })).outputStyle, '');
  assert.throws(() => loadConfig(deskWith({ repos: [], outputStyle: 3 })), /outputStyle must be a string/);
});

test('loadConfig: refuses bad and duplicate ids, a repo without a path, bad JSON', () => {
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'Bad Id', path: '.' }] })), /repos\[0\]\.id/);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: '.' }, { id: 'a', path: '..' }] })), /repos\[1\]\.id/);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a' }] })), /no path/);
  const d = tmp(); writeFileSync(join(d, 'desk.config.json'), '{');
  assert.throws(() => loadConfig(d), /desk\.config\.json/);
});

test('kind: git by default, folder entries have no worktrees, anything else refused', () => {
  const d = deskWith({ worktreesDir: 'wt', repos: [{ id: 'a', path: 'a' }, { id: 'n', path: 'n', kind: 'folder', worktreePrefix: 'n-' }] });
  const c = loadConfig(d);
  assert.deepEqual(c.repos.map((r) => [r.kind, r.gh]), [['git', ''], ['folder', '']]);
  mkdirSync(join(d, 'wt', 'n-x'), { recursive: true }); writeFileSync(join(d, 'wt', 'n-x', '.git'), '');
  assert.deepEqual(worktreeList(c), []);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', kind: 'svn' }] })), /kind must be git or folder/);
});

test('repoFor: --repo, the only repo, or an error naming the choices', () => {
  const one = loadConfig(deskWith({ repos: [{ id: 'a', path: 'a' }] }));
  const two = loadConfig(deskWith({ repos: [{ id: 'a', path: 'a' }, { id: 'b', path: 'b' }] }));
  assert.equal(repoFor(one).id, 'a');
  assert.equal(repoFor(two, 'b').id, 'b');
  assert.throws(() => repoFor(two), /--repo <a\|b>/);
  assert.throws(() => repoFor(two, 'zz'), /no repo "zz"/);
});

test('a worktreePrefix that starts another repo\'s prefix is refused', () => {
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', worktreePrefix: 'x-' }, { id: 'b', path: 'b', worktreePrefix: 'x-b-' }] })), /"x-" \(a\) is a prefix of "x-b-" \(b\)/);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', worktreePrefix: 'x-' }, { id: 'b', path: 'b', worktreePrefix: 'x-' }] })), /prefix/);
  assert.doesNotThrow(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', worktreePrefix: 'x-' }, { id: 'n', kind: 'folder', path: 'n', worktreePrefix: 'x-' }] })), 'folders have no worktrees');
});

test('slug -> worktree: prefix per repo, folders without .git skipped, legacy prefix', () => {
  const d = deskWith({ worktreesDir: 'wt', repos: [
    { id: 'kit', path: 'k', worktreePrefix: 'ikit-' }, { id: 'a', path: 'a' }, { id: 'ab', path: 'ab' }] });
  const c = loadConfig(d);
  for (const w of ['ikit-guard-hooks', 'a-one', 'ab-two']) { mkdirSync(join(d, 'wt', w), { recursive: true }); writeFileSync(join(d, 'wt', w, '.git'), 'gitdir: x\n'); }
  mkdirSync(join(d, 'wt', 'ikit-removed')); // left behind by a removal: not open
  mkdirSync(join(d, 'wt', 'other-x'));
  const got = worktreeList(c).map((w) => `${w.repo.id}:${w.slug}`).sort();
  assert.deepEqual(got, ['a:one', 'ab:two', 'kit:guard-hooks']);
  assert.equal(wtDir(c, c.repos[0], 'guard-hooks'), join(d, 'wt', 'ikit-guard-hooks'));
});

test('transcript folders: every non-alphanumeric becomes -, matched case-insensitively', () => {
  assert.equal(projectDirName('C:\\x\\my desk'), 'C--x-my-desk');
  const c = loadConfig(deskWith({ repos: [{ id: 'a', path: '../a' }] }));
  const p = projectPrefixes(c);
  assert.ok(isDeskProject(p, projectDirName(c.home).toUpperCase()));
  assert.ok(isDeskProject(p, projectDirName(join(c.worktreesDir, 'a-x'))));
  assert.ok(!isDeskProject(p, projectDirName(c.home) + 'x'));
});
