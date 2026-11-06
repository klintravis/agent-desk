// `npm test`: runs every test/*.test.mjs. Node 20 has no glob in `node --test` and a bare `node --test`
// would run the helpers too, and cmd.exe does not expand globs, so list the files here.
import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Relative paths: glob characters in an absolute checkout path would match nothing on Node 22. npm runs this from the package root.
const files = readdirSync('test').filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `test/${f}`);
// One temp parent for the run (test/helpers.mjs tmp() makes its folders under it), removed after. Under os.tmpdir(), never the checkout: findDesk walks up.
const parent = mkdtempSync(join(tmpdir(), 'agent-desk-run-'));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: { ...process.env, TMP: parent, TEMP: parent, TMPDIR: parent } });
try { rmSync(parent, { recursive: true, force: true }); } catch (e) { console.error(`warning: could not remove ${parent}: ${e.message}`); } // a failed cleanup must not change the exit code
process.exit(r.status ?? 1);
