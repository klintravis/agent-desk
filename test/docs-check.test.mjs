import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { gaps } from '../scripts/docs-check.mjs';
import { KIT, tmp } from './helpers.mjs';

const SCRIPT = join(KIT, 'scripts', 'docs-check.mjs');

// A real copy of what the check reads, so a parser that stops matching fails these tests.
// Each edit must change its file: a stale edit says so instead of failing with an empty list.
function copy(edits = {}) {
  const d = tmp();
  for (const f of ['README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD-PARTY.md', 'bin', 'lib', 'package.json', 'openspec']) cpSync(join(KIT, f), join(d, f), { recursive: true });
  for (const [f, fn] of Object.entries(edits)) {
    const before = readFileSync(join(d, f), 'utf8'), after = fn(before);
    assert.notEqual(after, before, `edit of ${f} changed nothing`);
    writeFileSync(join(d, f), after);
  }
  return d;
}
const fixture = (readme, pkg = { engines: { node: '>=20' } }) => {
  const d = tmp();
  if (readme != null) writeFileSync(join(d, 'README.md'), readme);
  writeFileSync(join(d, 'package.json'), JSON.stringify(pkg));
  return d;
};
// A tiny desk CLI: COMMANDS = { <cmd> }, a README row, and an inventory that lists `items`.
const ITEMS = ['desk st', '--json', '--dry-run', '--no-build'];
function cli(src, row = '| `desk st` | x |', { cmd = 'st', items = ITEMS, inventory = true } = {}) {
  const d = fixture(`## Commands\n\n${row}\n\n${items.map((i) => `\`${i}\``).join(' ')}\n`);
  mkdirSync(join(d, 'bin')); mkdirSync(join(d, 'lib')); mkdirSync(join(d, 'openspec'));
  writeFileSync(join(d, 'bin/desk.mjs'), `${src}\nconst COMMANDS = { ${cmd} };\nexport async function main([cmd]) {}\n`);
  if (inventory) writeFileSync(join(d, 'openspec/inventory.md'), `| item |\n|---|\n${items.map((i) => `| \`${i}\` | x |`).join('\n')}\n`);
  return d;
}

test('the kit has no docs gaps', () => {
  const g = gaps(KIT);
  assert.deepEqual(g, [], `docs gaps:\n- ${g.join('\n- ')}`);
});

test('drift in the real files is found', () => {
  const one = (edits, ...words) => {
    const g = gaps(copy(edits));
    assert.ok(g.some((l) => words.every((w) => l.includes(w))), `no one gap holds ${words.join(', ')} in:\n${g.join('\n')}`);
  };
  const readme = (fn) => ({ 'README.md': fn }), inv = (fn) => ({ 'openspec/inventory.md': fn });
  one(readme((t) => t.replaceAll('--rebased', '')), 'desk wt', '--rebased', 'lib/wt.mjs', 'README.md');
  one(readme((t) => t.replaceAll('`desk workspace`', '`desk wsx`')), 'desk workspace', 'bin/desk.mjs');
  one(readme((t) => t.replace('| `desk home` |', '| `desk nosuch` | x |\n| `desk home` |')), 'desk nosuch', 'not in bin/desk.mjs');
  one(readme((t) => t.replace('[--no-build]', '[--no-build] [--nosuch]')), 'desk wt', '--nosuch', 'not in lib/wt.mjs');
  one(readme((t) => t.replace('\\|discard', '')), 'desk wt discard', 'lib/wt.mjs');
  one(readme((t) => t.replace('(#worktree-flow)', '(#nosuch-flow)')), '#nosuch-flow');
  one(readme((t) => t.replace('Node 20 or later', 'Node 18 or later')), 'Node 18 or later', '>=20');
  one(inv((t) => t.split('\n').filter((l) => !l.startsWith('| `--rebased`')).join('\n')), 'desk wt --rebased', 'openspec/inventory.md');
  one(inv((t) => `${t}\n| \`zz-nosuch\` | x | y |\n`), 'zz-nosuch', 'not in README.md');
});

test('links: broken fails; fenced, inline code, URLs and anchors pass', () => {
  assert.deepEqual(gaps(fixture('[a](docs/none.md) [b](#x) [c](https://example.com/x) [d](mailto:a@b.c)\n')), ['README.md: broken link docs/none.md']);
  assert.deepEqual(gaps(fixture('```\n[a](docs/none.md)\n```\n`[b](docs/none.md)`\n[ok](package.json#top)\n')), []);
});

test('Node version must match engines', () => {
  assert.deepEqual(gaps(fixture('Needs Node 18 or later.\n')), ['README.md: says "Node 18 or later", package.json engines say >=20']);
  assert.equal(gaps(fixture('Needs Node.js 18 or above.\n')).length, 1);
  assert.deepEqual(gaps(fixture('Needs Node 20+ or Node 20 or newer.\n')), []);
});

test('a missing README is a gap', () => {
  assert.match(gaps(fixture(null))[0], /^README\.md: missing/);
});

test('no bin/desk.mjs means no CLI gaps', () => {
  assert.deepEqual(gaps(fixture('## Commands\n\n| `desk x` | y |\n')), []);
});

test('a missing inventory is a gap when the CLI exists', () => {
  assert.deepEqual(gaps(cli('function st() {}', undefined, { inventory: false })), ['openspec/inventory.md: missing']);
});

test('git arguments are not flags; a code flag missing from the row is', () => {
  assert.deepEqual(gaps(cli("function st() { git('status', '--porcelain'); git('merge', '--ff-only'); }")), []);
  const json = `function st(argv) { if (argv.includes('--json')) {} }`;
  assert.deepEqual(gaps(cli(json)), ['desk st: --json in bin/desk.mjs, not in README.md']);
  assert.deepEqual(gaps(cli(json, '| `desk st [--json]` | x |')), []);
});

test('flags(argv, [...]) and flags(argv, X_FLAGS) are read', () => {
  assert.deepEqual(gaps(cli("function st(argv) { flags(argv, ['dryRun']); }")), ['desk st: --dry-run in bin/desk.mjs, not in README.md']);
  assert.deepEqual(gaps(cli("const ST_FLAGS = ['noBuild'];\nfunction st(argv) { flags(argv, ST_FLAGS); }")), ['desk st: --no-build in bin/desk.mjs, not in README.md']);
});

test('a handler that cannot be found is a gap, not silence', () => {
  assert.deepEqual(gaps(cli("const st = (argv) => argv.includes('--json');")), ['desk st: no function st in bin/desk.mjs, flags not checked']);
});

test('actions: all usage strings of a command count; a row with actions needs a usage string', () => {
  const items = ['desk wt', 'wt a', 'wt b', 'wt c'];
  const src = "function wt() { 'usage: desk wt a|b x'; }\nfunction wt2() { 'usage: desk wt b|c y'; }";
  assert.deepEqual(gaps(cli(src, '| `desk wt a\\|b\\|c` | x |', { cmd: 'wt', items })), []);
  assert.deepEqual(gaps(cli(src, '| `desk wt a\\|b` | x |', { cmd: 'wt', items })), ['desk wt c: in bin/desk.mjs, not in the Commands table of README.md']);
  const g = gaps(cli('function wt() {}', '| `desk wt a\\|b` | x |', { cmd: 'wt', items: ['desk wt'] }));
  assert.equal(g.length, 1);
  assert.match(g[0], /desk wt: README\.md lists actions a\|b, but no usage string/);
});

test('actions: one per row counts; flag alternatives are not actions', () => {
  const items = ['desk wt', 'wt a', 'wt b', 'wt c'];
  const src = "function wt() { 'usage: desk wt a|b x'; }";
  assert.deepEqual(gaps(cli(src, '| `desk wt a <x>` | x |\n| `desk wt b <x>` | x |', { cmd: 'wt', items })), []);
  assert.deepEqual(gaps(cli(src, '| `desk wt a <x>` | x |\n| `desk wt b <x>` | x |\n| `desk wt c <x>` | x |', { cmd: 'wt', items })), ['desk wt c: in the Commands table of README.md, not in bin/desk.mjs']);
  assert.deepEqual(gaps(cli("function st(argv) { argv.includes('--json'); argv.includes('--dry-run'); }", '| `desk st --json\\|--dry-run` | x |')), []);
  assert.match(gaps(cli('function st() {}', '| `desk st a\\|b\\|--c` | x |')).join('\n'), /lists actions a\|b, but/);
});

test('flag literals in a self-test the handler calls do not count', () => {
  assert.deepEqual(gaps(cli("function stTest() { return 'x'.includes('--zzz'); }\nfunction st(argv) { stTest(); }")), []);
});

test('an unparsable COMMANDS is a gap, not silence', () => {
  const d = cli('function st() {}');
  writeFileSync(join(d, 'bin/desk.mjs'), 'export const x = 1;\n');
  assert.match(gaps(d)[0], /cannot parse/);
});

test('the script prints the gaps and sets the exit code', () => {
  const run = (d) => spawnSync(process.execPath, [SCRIPT, d], { encoding: 'utf8' });
  const ok = run(KIT);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /^docs-check: ok/);
  const bad = run(fixture('[a](none.md)\n'));
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, 'docs-check: 1 gap\n- README.md: broken link none.md\n');
  assert.equal(run(join(tmp(), 'no-such-dir')).status, 1);
});
