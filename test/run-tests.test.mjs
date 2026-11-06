import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmp } from './helpers.mjs';

test('scripts/test.mjs runs *.test.mjs only, exits 1 when a test fails, and removes its temp folder', () => {
  const d = tmp();
  mkdirSync(join(d, 'test'));
  writeFileSync(join(d, 'test', 'a.test.mjs'), "import { test } from 'node:test'; import { tmpdir } from 'node:os'; import { writeFileSync } from 'node:fs'; writeFileSync('tmpdir', tmpdir()); test('x', () => { throw new Error('boom'); });");
  writeFileSync(join(d, 'test', 'helper.mjs'), "import { writeFileSync } from 'node:fs'; writeFileSync('ran', '');");
  const { NODE_TEST_CONTEXT, ...env } = process.env; // we run under `node --test`; the child must not inherit that
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/test.mjs', import.meta.url))], { cwd: d, env, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(existsSync(join(d, 'ran')), false);
  const inner = readFileSync(join(d, 'tmpdir'), 'utf8');
  assert.notEqual(inner, tmpdir());
  assert.equal(existsSync(inner), false);
  rmSync(d, { recursive: true, force: true });
});

test('desk check: kit tests run from a checkout path with glob characters', () => {
  const d = join(tmp(), 'k[1]');
  for (const f of ['bin', 'lib', 'hooks', 'schemas', 'scripts', 'package.json']) cpSync(fileURLToPath(new URL('../' + f, import.meta.url)), join(d, f), { recursive: true });
  mkdirSync(join(d, 'test'));
  writeFileSync(join(d, 'test', 'a.test.mjs'), "import { test } from 'node:test'; import { tmpdir } from 'node:os'; import { writeFileSync } from 'node:fs'; writeFileSync('tmpdir', tmpdir()); test('x', () => {});");
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  // DESK_HOME blank and node-only PATH: the inner check must not read the live desk or run claude.
  const r = spawnSync(process.execPath, [join(d, 'bin', 'desk.mjs'), 'check'], { cwd: d, env: { ...env, DESK_HOME: '', PATH: dirname(process.execPath), Path: dirname(process.execPath) }, encoding: 'utf8', timeout: 400e3 });
  assert.match(r.stdout, /^ok +kit tests$/m);
  const inner = readFileSync(join(d, 'tmpdir'), 'utf8');
  assert.notEqual(inner, tmpdir());
  assert.equal(existsSync(inner), false);
  rmSync(dirname(d), { recursive: true, force: true });
});
