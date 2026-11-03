// Preload for a CLI child (NODE_OPTIONS=--import): `gh` never runs. Each call is logged and answered from
// the JSON file named by GH_STUB. A preload that fails to load stops node, so no child can reach the real one.
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { appendFileSync, readFileSync } from 'node:fs';

const cp = createRequire(import.meta.url)('node:child_process');
const real = cp.execFileSync;
const READ_STDIN = 'process.stdout.write(require("node:fs").readFileSync(0, "utf8"))';

function gh(args, opts) {
  const s = JSON.parse(readFileSync(process.env.GH_STUB, 'utf8')), call = args.slice(2).join(' ');
  // What a real child gets on stdin under these same options, not just what the option says.
  const stdin = opts?.input === undefined ? undefined : real(process.execPath, ['-e', READ_STDIN], opts);
  appendFileSync(`${process.env.GH_STUB}.log`, JSON.stringify({ args, stdin }) + '\n');
  if (s.missing) throw Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' });
  if (s.fail && call.startsWith(s.fail)) throw Object.assign(new Error('Command failed: gh'), { status: 1, stderr: 'gh says boom\n' });
  if (args[0] === 'api') return JSON.stringify({ data: { repository: { pullRequests: { nodes: s.graphql ?? [] } } } });
  if (call.startsWith('run list')) return JSON.stringify(s.runs ?? [{ status: 'completed', conclusion: 'success', databaseId: 1 }]);
  if (call.startsWith('pr list')) return JSON.stringify(s.prs ?? []);
  if (call.startsWith('pr create')) return 'https://github.example/o/r/pull/7\n';
  if (call.startsWith('pr edit')) return '';
  throw new Error(`gh-stub: no answer for ${call}`);
}

cp.execFileSync = (cmd, args, opts) => (cmd === 'gh' ? gh(args, opts) : real(cmd, args, opts));
for (const name of ['spawn', 'spawnSync', 'execFile']) {
  const fn = cp[name];
  cp[name] = (cmd, ...rest) => { if (cmd === 'gh') throw new Error(`gh-stub: ${name} is not stubbed`); return fn(cmd, ...rest); };
}
syncBuiltinESMExports();
