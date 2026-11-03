// Shared fixtures: temp dirs, throwaway git repos with a bare origin, and the CLI run in a child
// process (config() caches per process, so each desk gets its own).
import { mkdtempSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BIN = join(KIT, 'bin', 'desk.mjs');
// realpath: macOS hands out /var/... for a /private/var/... folder, and git reports the real one.
export const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), 'agent-desk-')));

// Outside every desk, repo and worktree a test makes, and never created: no test, in this process or a
// child (process.env is what they all inherit), reads a real user file.
export const NO_USER_SETTINGS = join(tmp(), 'settings.json');
process.env.AGENT_DESK_SETTINGS = NO_USER_SETTINGS;
export const env = (home) => ({
  ...process.env, DESK_HOME: home, CLAUDE_CODE_SESSION_ID: 'testsess',
  GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
});
export const desk = (home, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: home, env: env(home), encoding: 'utf8' });
export const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', env: env(''), stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// <root>/<name>.git (bare origin) and <root>/<name> (clone on main, one commit pushed).
// remote: false makes a local-only repo (no origin).
export function repo(root, name, { remote = true } = {}) {
  const bare = join(root, `${name}.git`), dir = join(root, name);
  if (remote) {
    execFileSync('git', ['init', '-q', '--bare', bare]);
    git(bare, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    execFileSync('git', ['clone', '-q', bare, dir], { stdio: 'ignore' });
  } else execFileSync('git', ['init', '-q', dir]);
  git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  commit(dir, 'README.md', `# ${name}\n`);
  if (remote) git(dir, 'push', '-q', '-u', 'origin', 'main');
  return dir;
}

export function commit(dir, file, text) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
  git(dir, 'add', file);
  git(dir, 'commit', '-q', '-m', `edit ${file}`);
  return git(dir, 'rev-parse', 'HEAD');
}

// A desk over <root>/a (git, bare origin, no gh), <root>/b (git, no remote) and <root>/notes (a plain
// folder): <root>/desk, worktrees in <root>/worktrees.
export function multiDesk() {
  const root = tmp(), home = join(root, 'desk');
  repo(root, 'a'); repo(root, 'b', { remote: false });
  mkdirSync(join(root, 'notes')); writeFileSync(join(root, 'notes', 'plan.txt'), 'notes\n');
  mkdirSync(home);
  const r = desk(home, 'init', '--no-install', '--repo', 'a=../a', '--repo', 'b=../b', '--repo', 'notes=../notes');
  if (r.status !== 0) throw new Error(`init failed: ${r.stderr}`);
  return { root, home };
}
