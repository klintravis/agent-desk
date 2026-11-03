// `desk init [--repo <id>=<path> ...] [--worktrees <dir>] [--harness claude,copilot]`: makes the
// current folder a desk. A path with `.git` becomes a git repo, any other folder a
// `kind: "folder"` entry. Writes desk.config.json, AGENTS.md (+ CLAUDE.md importing it),
// agent-rules.md, empty todo.jsonl/board.jsonl/decisions.jsonl, .gitignore, the .code-workspace and
// package.json pinning the kit, then `npm install` (--no-install skips it).
// Never overwrites: an existing file is kept and reported. Run `desk sync` next.
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, resolve, relative, isAbsolute, basename } from 'node:path';
import { KIT, kitVersion, SLUG, deskKit, psq } from './config.mjs';

const tryGit = (dir, ...a) => { try { return execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
// owner/name from a GitHub remote URL (https or ssh), else ''.
export const ghName = (url) => /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url)?.[1] ?? '';

export function repoEntry(home, id, path) {
  if (!SLUG.test(id)) throw new Error(`repo id "${id}" must be lowercase letters, digits and dashes`);
  const abs = resolve(home, path);
  if (!existsSync(abs)) throw new Error(`${abs} does not exist`);
  const rel = relative(home, abs), p = rel && !isAbsolute(rel) ? rel.replace(/\\/g, '/') : abs.replace(/\\/g, '/');
  if (!existsSync(join(abs, '.git'))) return { id, kind: 'folder', path: p }; // not a checkout: a plain folder
  const head = tryGit(abs, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, '')
    || tryGit(abs, 'branch', '--show-current'); // no origin: the local branch checked out
  return { id, kind: 'git', path: p, gh: ghName(tryGit(abs, 'remote', 'get-url', 'origin')), defaultBranch: head || 'main',
    worktreePrefix: `${id}-`, branchPrefix: 'agent/', install: '', build: '', check: '' };
}

export function init(argv = []) {
  const home = resolve(process.cwd()); // never DESK_HOME: init makes a new desk, and DESK_HOME may name another
  const repos = [], harnesses = [];
  let worktreesDir = '../worktrees';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') { const [id, ...p] = (argv[++i] ?? '').split('='); repos.push(repoEntry(home, id, p.join('=') || '.')); }
    else if (argv[i] === '--worktrees') worktreesDir = argv[++i];
    else if (argv[i] === '--harness') harnesses.push(...argv[++i].split(','));
    else throw new Error(`unknown argument ${argv[i]}; usage: desk init [--repo <id>=<path> ...] [--worktrees <dir>] [--harness claude,copilot] [--no-install]`);
  }
  const cfg = { kitVersion: kitVersion(), worktreesDir, scratchDir: 'scratch', repos,
    harnesses: harnesses.length ? harnesses : ['claude', 'copilot'],
    permissions: { deny: [], additionalDirectories: [] } };
  const tpl = (f) => readFileSync(join(KIT, 'templates', f), 'utf8');
  const files = {
    'desk.config.json': JSON.stringify(cfg, null, 2) + '\n',
    'AGENTS.md': tpl('AGENTS.md'),
    'CLAUDE.md': '@AGENTS.md\n', // Claude Code imports the one instructions file
    'agent-rules.md': tpl('agent-rules.md'),
    'todo.jsonl': '', 'board.jsonl': '', 'decisions.jsonl': '',
    '.gitignore': 'board.jsonl\nscratch/\nstreams/\n.vscode/\n.claude/settings.local.json\n.claude/synced-permissions.json\nnode_modules/\n*.log\n/desk\n/desk.cmd\n',
  };
  // An older desk keeps its rules in .claude/agent-rules.md (the context hook reads either): no second copy.
  if (existsSync(join(home, '.claude', 'agent-rules.md'))) delete files['agent-rules.md'];
  for (const [f, text] of Object.entries(files)) {
    const p = join(home, f);
    if (existsSync(p)) { console.log(`kept  ${p}`); continue; }
    writeFileSync(p, text);
    console.log(`wrote ${p}`);
  }
  pinKit(home);
  process.env.DESK_HOME = home; // the rest of this run reads the desk just written
  return home;
}

// The desk pins its kit like husky or commitlint: a devDependency on the release tag, so every
// generated hook calls <desk>/node_modules/agent-desk and an upgrade is one tag bump.
export const KIT_SPEC = `github:klintravis/agent-desk#v${kitVersion()}`;
export function pinKit(home) {
  const p = join(home, 'package.json');
  const pkg = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { name: basename(home).toLowerCase().replace(/[^a-z0-9-]/g, '-'), private: true };
  if (pkg.devDependencies?.['agent-desk']) return console.log(`kept  ${p} (agent-desk ${pkg.devDependencies['agent-desk']})`);
  pkg.devDependencies = { ...pkg.devDependencies, 'agent-desk': KIT_SPEC };
  writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`wrote ${p} (agent-desk ${KIT_SPEC})`);
}

function npmInstall(home) {
  // shell on Windows: npm is a .cmd shim there.
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: home, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) console.log(`warn npm install failed in ${home}: hooks use this kit (${KIT}) until it succeeds; run \`npm install\`, then \`./desk sync\``);
}

export async function initCmd(argv) {
  const install = !argv.includes('--no-install');
  const home = init(argv.filter((a) => a !== '--no-install'));
  if (install) npmInstall(home);
  const s = await import('./sync.mjs');
  s.workspace();
  for (const f of s.writeShim(home)) console.log(`wrote ${f} (the desk command: not on PATH, call it by path)`);
  const mjs = join(deskKit(home), 'bin', 'desk.mjs');
  console.log(`\nDesk ready in ${home}. Next: fill install/build/check per repo in desk.config.json, then \`./desk sync\` (PowerShell: \`$env:DESK_HOME = ${psq(home)}; node ${psq(mjs)} sync\`; cmd: \`set "DESK_HOME=${home}" && node "${mjs}" sync\`).`);
}
