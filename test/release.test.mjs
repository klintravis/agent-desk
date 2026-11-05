import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmp, KIT, git, commit } from './helpers.mjs';
import { bump, notes, versions, section, publish } from '../scripts/release.mjs';

const LOG = '# Changelog\n\nintro\n\n## Unreleased\n\n- new thing\n\n## 0.1.0 - 2026-10-31\n\n- first\n';
function fake(log = LOG) {
  const d = tmp();
  mkdirSync(join(d, '.claude-plugin'));
  mkdirSync(join(d, 'vscode'));
  writeFileSync(join(d, 'package.json'), '{\n  "name": "x",\n  "version": "0.1.0"\n}\n');
  writeFileSync(join(d, '.claude-plugin/plugin.json'), '{\n  "name": "x",\n  "version": "0.1.0"\n}\n');
  writeFileSync(join(d, 'vscode/package.json'), '{\n  "name": "x",\n  "version": "0.1.0"\n}\n');
  writeFileSync(join(d, 'CHANGELOG.md'), log);
  return d;
}
const snap = (d) => ['package.json', '.claude-plugin/plugin.json', 'vscode/package.json', 'CHANGELOG.md'].map((f) => readFileSync(join(d, f), 'utf8'));

test('repo: package and plugin versions agree and the CHANGELOG covers them', () => {
  const [a, b, c] = versions(KIT);
  assert.equal(a, b);
  assert.equal(a, c);
  const log = readFileSync(join(KIT, 'CHANGELOG.md'), 'utf8');
  assert.ok(section(log, a) !== null || section(log, 'Unreleased') !== null);
});

test('bump moves Unreleased entries under the new version', () => {
  const d = fake();
  bump('0.2.0', d, '2026-11-02');
  assert.deepEqual(versions(d), ['0.2.0', '0.2.0', '0.2.0']);
  assert.match(readFileSync(join(d, 'package.json'), 'utf8'), /^\{\n  "name": "x",\n  "version": "0.2.0"\n\}\n$/);
  const log = readFileSync(join(d, 'CHANGELOG.md'), 'utf8');
  assert.match(log, /## Unreleased\n\n## 0\.2\.0 - 2026-11-02\n\n- new thing\n\n## 0\.1\.0/);
  assert.equal(section(log, 'Unreleased'), '');
  assert.equal(notes('v0.2.0', d), '- new thing');
});

test('bump refuses a version that is not greater, not semver, or empty Unreleased; writes nothing', () => {
  for (const [v, log] of [['0.1.0', LOG], ['0.0.9', LOG], ['1.0', LOG], ['0.2.0', LOG.replace('- new thing\n', '')]]) {
    const d = fake(log), before = snap(d);
    assert.throws(() => bump(v, d), Error);
    assert.deepEqual(snap(d), before);
  }
});

test('bump and notes refuse when the version files disagree', () => {
  for (const f of ['.claude-plugin/plugin.json', 'vscode/package.json']) {
    const d = fake();
    writeFileSync(join(d, f), '{\n  "name": "x",\n  "version": "0.1.1"\n}\n');
    const before = snap(d);
    assert.throws(() => bump('0.2.0', d), /disagree/);
    assert.throws(() => notes('v0.1.0', d), /disagree/);
    assert.deepEqual(snap(d), before);
  }
});

test('notes prints the section body; wrong tag or missing section throws', () => {
  const d = fake();
  assert.equal(notes('v0.1.0', d), '- first');
  assert.throws(() => notes('v0.2.0', d), /not v0\.1\.0/);
  assert.throws(() => notes('0.1.0', d), /not v0\.1\.0/);
  assert.throws(() => notes('v0.1.0', fake(LOG.replace('## 0.1.0', '## 0.0.1'))), /no section/);
});

test('publish pushes each tag as one commit on the public main; private history stays out', () => {
  const d = fake(), pub = join(tmp(), 'pub.git');
  git(d, 'init', '-q', '-b', 'main');
  git(d, 'config', 'user.name', 'test');
  git(d, 'config', 'user.email', 'test@example.invalid');
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'private one');
  commit(d, 'a.txt', 'a\n');
  git(d, 'tag', 'v0.1.0');
  execFileSync('git', ['init', '-q', '--bare', pub]);
  git(d, 'remote', 'add', 'public', pub);

  const first = publish('v0.1.0', d);
  assert.equal(git(pub, 'log', '--format=%s', 'main').trim(), 'Release v0.1.0');
  assert.equal(git(pub, 'rev-parse', 'main').trim(), first);
  assert.equal(git(pub, 'rev-parse', 'v0.1.0').trim(), first);
  assert.equal(git(pub, 'rev-parse', 'main^{tree}').trim(), git(d, 'rev-parse', 'v0.1.0^{tree}').trim());
  assert.throws(() => publish('v0.1.0', d)); // the tag is already there
  assert.equal(git(pub, 'rev-parse', 'main').trim(), first);

  bump('0.2.0', d, '2026-11-01');
  git(d, 'tag', 'v0.2.0');
  assert.throws(() => publish('v0.2.0', d), /does not match/); // the bump is not in the tag
  assert.equal(git(pub, 'rev-parse', 'main').trim(), first);
  git(d, 'tag', '-d', 'v0.2.0');
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'private two');
  git(d, 'tag', 'v0.2.0');
  const second = publish('v0.2.0', d);
  assert.equal(git(pub, 'rev-parse', 'main^').trim(), first);
  assert.equal(git(pub, 'rev-parse', 'main').trim(), second);
  assert.equal(git(pub, 'rev-list', '--count', 'main').trim(), '2');

  git(d, 'checkout', '-qb', 'side');
  commit(d, 'b.txt', 'b\n');
  git(d, 'tag', '-f', 'v0.2.0');
  assert.throws(() => publish('v0.2.0', d), /not on main/);
});

test('CI picks runners by visibility; releases run only on a public repo', () => {
  const yml = (f) => readFileSync(join(KIT, '.github/workflows', f), 'utf8');
  const ci = yml('ci.yml');
  assert.ok(ci.includes(`github.event.repository.private && fromJSON('[["self-hosted","linux","adesk"]]') || fromJSON('["ubuntu-latest","windows-latest","macos-latest"]')`));
  assert.ok(ci.includes(`github.event.repository.private && fromJSON('["self-hosted","linux","adesk"]') || 'ubuntu-latest'`), 'Node 20 on Linux only');
  assert.ok(ci.includes(`if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name != github.repository`), 'one run per commit: pull_request only for forks');
  assert.ok(yml('release.yml').includes('if: ${{ !github.event.repository.private }}'));
  const rel = yml('release.yml');
  const create = rel.indexOf('gh release create');
  assert.ok(/gh release create.*\.vsix/.test(rel), 'release attaches the vsix');
  assert.ok(rel.indexOf('vsce@') > -1 && rel.indexOf('vsce@') < create, 'vsce packages before the release exists');
});
