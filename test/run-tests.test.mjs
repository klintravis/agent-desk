import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmp } from './helpers.mjs';

test('scripts/test.mjs runs *.test.mjs only, and exits 1 when a test fails', () => {
  const d = tmp();
  mkdirSync(join(d, 'test'));
  writeFileSync(join(d, 'test', 'a.test.mjs'), "import { test } from 'node:test'; test('x', () => { throw new Error('boom'); });");
  writeFileSync(join(d, 'test', 'helper.mjs'), "import { writeFileSync } from 'node:fs'; writeFileSync('ran', '');");
  const { NODE_TEST_CONTEXT, ...env } = process.env; // we run under `node --test`; the child must not inherit that
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/test.mjs', import.meta.url))], { cwd: d, env, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(existsSync(join(d, 'ran')), false);
  rmSync(d, { recursive: true, force: true });
});
