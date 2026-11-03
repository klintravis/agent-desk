// `npm test`: runs every test/*.test.mjs. Node 20 has no glob in `node --test` and a bare `node --test`
// would run the helpers too, and cmd.exe does not expand globs, so list the files here.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Relative paths: glob characters in an absolute checkout path would match nothing on Node 22. npm runs this from the package root.
const files = readdirSync('test').filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `test/${f}`);
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
