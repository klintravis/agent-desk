import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT, multiDesk, desk, ok, commit } from './helpers.mjs';
import { RULES, matchLenses, addedLines } from '../lib/lenses.mjs';

const lines = (x) => matchLenses(x).map((l) => `${l.lens}: ${l.why}`);

test('the rules are the stack-lens table, same names and order', () => {
  const table = readFileSync(join(KIT, 'skills/stack-lens/SKILL.md'), 'utf8').match(/^\| [a-z]+ \|/gm).map((r) => r.slice(2, -2));
  assert.deepEqual(RULES.map((r) => r.lens), table);
});

test('path rules: a ts file, a test file, a hooks file, a pane file', () => {
  assert.deepEqual(lines({ files: ['lib/a.ts'] }), ['typescript: lib/a.ts']);
  assert.deepEqual(lines({ files: ['test/x.test.mjs'] }), ['testing: test/x.test.mjs']);
  assert.deepEqual(lines({ files: ['src/x.spec.js'] }), ['testing: src/x.spec.js']);
  assert.deepEqual(lines({ files: ['hooks/redact.ts', 'hooks/pane.tsx'] }),
    ['typescript: hooks/redact.ts (+1)', 'security: hooks/redact.ts (+1)', 'ui: hooks/pane.tsx']);
});

test('kind rules: fix brings testing, perf brings perf, feature brings nothing', () => {
  assert.deepEqual(lines({ files: ['lib/a.ts'], kind: 'fix' }), ['typescript: lib/a.ts', 'testing: kind fix']);
  assert.deepEqual(lines({ files: [], kind: 'perf' }), ['perf: kind perf']);
  assert.deepEqual(lines({ files: ['README.md'], kind: 'feature' }), []);
});

test('content rules apply to added code lines, never to docs', () => {
  const added = new Map([
    ['lib/wt.mjs', "writeFileSync(p, x);\nconst r = spawnSync('git', a);\nprocess.stdout.write(r);\n"],
    ['skills/x/SKILL.md', 'take the lock, keep the secret, process.stdout.write( it\n'],
  ]);
  assert.deepEqual(lines({ files: [...added.keys()], added }),
    ['state: lib/wt.mjs adds writeFileSync', 'security: lib/wt.mjs adds spawnSync(', 'ui: lib/wt.mjs adds process.stdout.write(']);
  assert.deepEqual(lines({ files: ['lib/a.mjs'], added: new Map([['lib/a.mjs', 'const block = clock + 1;\n']]) }), [], 'no lock inside a word');
});

test('test files: fixtures in them trigger no content lens, and hooks tests no security path rule', () => {
  const added = new Map([['test/x.test.mjs', "writeFileSync(p, 'secret'); process.stdout.write('x');\n"]]);
  assert.deepEqual(lines({ files: ['test/x.test.mjs'], added }), ['testing: test/x.test.mjs']);
  assert.deepEqual(lines({ files: ['hooks/a.test.ts'] }), ['typescript: hooks/a.test.ts', 'testing: hooks/a.test.ts']);
});

test('comment lines are not scanned', () => {
  const added = new Map([['lib/a.mjs', '// take the lock, hide the secret\n  * a retry queue\n/* mutex */\n# password\n']]);
  assert.deepEqual(lines({ files: ['lib/a.mjs'], added }), []);
  assert.deepEqual(lines({ files: ['lib/a.mjs'], added: new Map([['lib/a.mjs', 'x(); // lock\nlock();\n']]) }), ['state: lib/a.mjs adds lock']);
});

test('console.log alone is not a ui signal', () => {
  assert.deepEqual(lines({ files: ['lib/a.mjs'], added: new Map([['lib/a.mjs', 'console.log(x);\nconsole.error(y);\n']]) }), []);
});

test('desk lenses: the todo kind, --json, nothing once the todo is done, no worktree', () => {
  const { home, root } = multiDesk();
  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a', '--no-build'));
  const wt = join(root, 'worktrees', 'a-demo');
  ok(desk(home, 'todo', 'add', 'speed it up', '--area', 'a', '--kind', 'perf'));
  ok(desk(home, 'todo', 'note', 'T-1', 'accept: it is fast | true | exit 0'));
  ok(desk(home, 'todo', 'start', 'T-1', '--slug', 'demo'));
  commit(wt, 'README.md', '# docs only\n');
  assert.equal(ok(desk(home, 'lenses', 'demo')), 'perf: kind perf\n');
  assert.deepEqual(JSON.parse(ok(desk(home, 'lenses', 'demo', '--json'))), [{ lens: 'perf', why: 'kind perf' }]);
  ok(desk(home, 'todo', 'done', 'T-1'));
  assert.equal(ok(desk(home, 'lenses', 'demo')), '');
  const r = desk(home, 'lenses', 'nosuch');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /desk lenses: no worktree "nosuch"/);
});

test('addedLines reads + lines of hunks, not headers, and skips deletions', () => {
  const patch = [
    'diff --git a/lib/a.mjs b/lib/a.mjs', '--- a/lib/a.mjs', '+++ b/lib/a.mjs', '@@ -1 +1,2 @@', '-old', '+new one', '++ starts with plus',
    'diff --git a/gone.mjs b/gone.mjs', 'deleted file mode 100644', '--- a/gone.mjs', '+++ /dev/null', '@@ -1 +0,0 @@', '-bye',
  ].join('\n');
  assert.deepEqual([...addedLines(patch)], [['lib/a.mjs', 'new one\n+ starts with plus\n']]);
});
