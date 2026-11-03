#!/usr/bin/env node
// Release helper: `bump <version>`, `notes <tag>` and `publish <tag>`. No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['package.json', '.claude-plugin/plugin.json', 'vscode/package.json'];
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const VERSION = /("version"\s*:\s*")([^"]*)(")/;

const read = (root, f) => readFileSync(join(root, f), 'utf8');
export const versions = (root = ROOT) => FILES.map((f) => VERSION.exec(read(root, f))?.[2]);
function agreed(root) {
  const v = versions(root);
  if (new Set(v).size > 1) throw new Error(`versions disagree: ${FILES.map((f, i) => `${f} (${v[i]})`).join(', ')}`);
  return v[0];
}
const gt = (a, b) => { const [x, y] = [a, b].map((v) => SEMVER.exec(v).slice(1).map(Number)); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

// The text of `## <title>` up to the next `## ` heading (null if there is no such section).
// `title` matches exactly, or as `<title> - <date>`.
export function section(changelog, title) {
  const lines = changelog.split(/\r?\n/);
  const i = lines.findIndex((l) => l === `## ${title}` || l.startsWith(`## ${title} - `));
  if (i < 0) return null;
  let j = lines.findIndex((l, k) => k > i && l.startsWith('## '));
  if (j < 0) j = lines.length;
  return lines.slice(i + 1, j).join('\n').trim();
}

export function bump(version, root = ROOT, date = new Date().toLocaleDateString('sv')) {
  if (!SEMVER.test(version)) throw new Error(`version must be x.y.z, got ${version}`);
  const pkg = agreed(root);
  if (!gt(version, pkg)) throw new Error(`${version} is not greater than the current ${pkg}`);
  const log = read(root, 'CHANGELOG.md');
  if (!section(log, 'Unreleased')) throw new Error('CHANGELOG.md has no entries under ## Unreleased');
  writeFileSync(join(root, 'CHANGELOG.md'), log.replace(/^## Unreleased[ \t]*$/m, `## Unreleased\n\n## ${version} - ${date}`));
  for (const f of FILES) writeFileSync(join(root, f), read(root, f).replace(VERSION, `$1${version}$3`));
}

export function notes(tag, root = ROOT) {
  const pkg = agreed(root);
  if (tag !== `v${pkg}`) throw new Error(`tag ${tag} is not v${pkg}`);
  const body = section(read(root, 'CHANGELOG.md'), pkg);
  if (body === null) throw new Error(`CHANGELOG.md has no section for ${pkg}`);
  return body;
}

// The public repo gets one commit per release: the tag's tree on top of its own main, so the
// private history stays out. Never push a private branch or tag to it.
export function publish(tag, root = ROOT, remote = 'public') {
  notes(tag, root);
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  // notes read the checkout, the push ships the tag's tree: they must agree.
  try { git('diff', '--quiet', tag, '--', ...FILES, 'CHANGELOG.md'); } catch { throw new Error(`${tag} does not match the checked-out version files`); }
  try { git('merge-base', '--is-ancestor', tag, 'main'); } catch { throw new Error(`tag ${tag} is not on main`); }
  const head = git('ls-remote', remote, 'refs/heads/main').split(/\s/)[0];
  if (head) git('fetch', '-q', remote, 'refs/heads/main');
  const commit = git('commit-tree', `${tag}^{tree}`, ...(head ? ['-p', head] : []), '-m', `Release ${tag}`);
  git('push', '-q', '--atomic', remote, `${commit}:refs/heads/main`, `${commit}:refs/tags/${tag}`);
  return commit;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === 'bump' && arg) { bump(arg); console.log(`bumped to ${arg}`); }
    else if (cmd === 'notes' && arg) console.log(notes(arg));
    else if (cmd === 'publish' && arg) console.log(`published ${arg} as ${publish(arg)}`);
    else throw new Error('usage: release.mjs bump <x.y.z> | notes v<x.y.z> | publish v<x.y.z>');
  } catch (e) { console.error(`release: ${e.message}`); process.exit(1); }
}
