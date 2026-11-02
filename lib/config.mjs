// The desk folder and its desk.config.json. Everything resolves lazily, so importing the CLI never
// needs a desk (tests, `desk init`, `--self-test`).
// Desk folder: DESK_HOME, else the nearest folder at or above cwd holding desk.config.json.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const kitVersion = (dir = KIT) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
// The kit a desk pins (`desk init` installs it as a devDependency), else the running one.
export const deskKit = (home) => { const d = join(home, 'node_modules', 'agent-desk'); return existsSync(join(d, 'package.json')) ? d : KIT; };
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
// A repo entry is a git checkout (worktrees, branches, merges) or a plain folder (listed in the
// workspace, readable from every checkout, a todo area; no worktrees).
const KINDS = ['git', 'folder'];

export function findDesk(start = process.cwd(), env = process.env) {
  if (env.DESK_HOME) return resolve(env.DESK_HOME);
  for (let d = resolve(start); ; d = dirname(d)) {
    if (existsSync(join(d, 'desk.config.json'))) return d;
    if (dirname(d) === d) return null;
  }
}

let home, cfg;
export function deskHome() {
  if (home) return home;
  home = findDesk();
  if (!home) throw new Error('no desk here: set DESK_HOME or run inside a folder with desk.config.json (`desk init` makes one)');
  return home;
}

// Paths in the file are relative to the desk folder. Defaults fill what a minimal config leaves out.
export function loadConfig(dir) {
  const file = join(dir, 'desk.config.json');
  let raw;
  try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file}: ${e.message}`); }
  const abs = (p) => resolve(dir, p);
  const ids = new Set();
  const repos = (raw.repos ?? []).map((r, i) => {
    if (!SLUG.test(r.id ?? '') || ids.has(r.id)) throw new Error(`${file}: repos[${i}].id must be unique lowercase letters, digits and dashes`);
    if (!r.path) throw new Error(`${file}: repos[${i}] (${r.id}) has no path`);
    if (!KINDS.includes(r.kind ?? 'git')) throw new Error(`${file}: repos[${i}] (${r.id}) kind must be ${KINDS.join(' or ')}`);
    ids.add(r.id);
    return { kind: 'git', gh: '', defaultBranch: 'main', branchPrefix: 'agent/', worktreePrefix: `${r.id}-`, install: '', build: '', check: '', ...r, path: abs(r.path) };
  });
  // A worktree folder name must say which repo it belongs to: no prefix may start another.
  const git = repos.filter((r) => r.kind === 'git');
  for (const a of git) for (const b of git) if (a !== b && b.worktreePrefix.startsWith(a.worktreePrefix))
    throw new Error(`${file}: worktreePrefix "${a.worktreePrefix}" (${a.id}) is a prefix of "${b.worktreePrefix}" (${b.id}); make them distinct`);
  if (raw.outputStyle !== undefined && typeof raw.outputStyle !== 'string') throw new Error(`${file}: outputStyle must be a string ("" leaves the output style alone)`);
  return { harnesses: ['claude'], permissions: {}, outputStyle: 'Concise', ...raw, home: dir, repos,
    worktreesDir: abs(raw.worktreesDir ?? '../worktrees'), scratchDir: abs(raw.scratchDir ?? 'scratch') };
}
export const config = () => (cfg ??= loadConfig(deskHome()));

// --repo <id>, else the only repo.
export function repoFor(c, id) {
  if (id) return c.repos.find((r) => r.id === id) ?? fail(`no repo "${id}" in desk.config.json (repos: ${c.repos.map((r) => r.id).join(', ') || 'none'})`);
  if (c.repos.length === 1) return c.repos[0];
  return fail(c.repos.length ? `several repos: pass --repo <${c.repos.map((r) => r.id).join('|')}>` : 'desk.config.json has no repos');
}
const fail = (msg) => { throw new Error(msg); };

export const wtDir = (c, repo, slug) => join(c.worktreesDir, repo.worktreePrefix + slug);
export const gitRepos = (c) => c.repos.filter((r) => r.kind === 'git');

// Where branches start and merge to: origin/<defaultBranch>, or the local branch in a clone without
// an `origin` remote (a local-only repo: no fetch, no push, no CI).
export const hasOrigin = (repo) => spawnSync('git', ['-C', repo.path, 'remote', 'get-url', 'origin'], { stdio: 'ignore' }).status === 0;
export const baseRef = (repo, remote = hasOrigin(repo)) => (remote ? `origin/${repo.defaultBranch}` : repo.defaultBranch);

// Open worktrees of every git repo, `.git` present (removal often leaves an empty folder on Windows).
// loadConfig refuses overlapping prefixes, so at most one repo matches a folder name.
export function worktreeList(c) {
  if (!existsSync(c.worktreesDir)) return [];
  return readdirSync(c.worktreesDir).flatMap((d) => {
    const repo = gitRepos(c).find((r) => d.startsWith(r.worktreePrefix));
    const dir = join(c.worktreesDir, d);
    return repo && existsSync(join(dir, '.git')) ? [{ slug: d.slice(repo.worktreePrefix.length), repo, dir }] : [];
  });
}

// Claude Code's transcript folder for a working directory: every character outside [a-zA-Z0-9]
// becomes '-' (C:\x\desk -> C--x-desk). Sessions in the desk, its repos and worktrees count.
export const projectDirName = (p) => p.replace(/[^a-zA-Z0-9]/g, '-');
export const projectPrefixes = (c) => [c.home, c.worktreesDir, ...c.repos.map((r) => r.path)].map((p) => projectDirName(p).toLowerCase());
// shortcut: prefix match also takes a sibling folder named like `<desk>-old`; use exact cwd from the transcript if that bites.
export const isDeskProject = (prefixes, dir) => prefixes.some((p) => { const d = dir.toLowerCase(); return d === p || d.startsWith(p + '-'); });
