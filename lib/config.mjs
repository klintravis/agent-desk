// The desk folder and its desk.config.json. Everything resolves lazily, so importing the CLI never
// needs a desk (tests, `desk init`).
// Desk folder: DESK_HOME, else the nearest folder at or above cwd holding desk.config.json.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { schema } from './schema.mjs';

// JSON.parse that tolerates a leading byte order mark (Windows editors add one).
export const parseJson = (text) => JSON.parse(text.replace(/^\uFEFF/, ''));
// Is this module the script node started? Also through a symlink or junction (npx, npm link, node_modules/agent-desk).
export function isMain(importMetaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  let real = '';
  try { real = realpathSync(argv1); } catch { /* a missing path is just not us */ }
  return [resolve(argv1), real].includes(fileURLToPath(importMetaUrl));
}
export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const kitVersion = (dir = KIT) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
// The kit a desk pins (`desk init` installs it as a devDependency), else the running one.
export const deskKit = (home) => { const d = join(home, 'node_modules', 'agent-desk'); return existsSync(join(d, 'package.json')) ? d : KIT; };
// PowerShell single-quoted string: nothing expands, an apostrophe is doubled.
export const psq = (s) => `'${s.replace(/'/g, "''")}'`;
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
// A repo entry is a git checkout (worktrees, branches, merges) or a plain folder (listed in the
// workspace, readable from every checkout, a todo area; no worktrees).
const KINDS = ['git', 'folder'];
export const HARNESSES = ['claude', 'copilot'];
// Lowest first. Other names (full ids, `best`, `inherit`, `[1m]` forms) are refused, so a floor can compare.
export const MODELS = ['haiku', 'sonnet', 'opus', 'fable'];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const ORDER = { model: MODELS, effort: EFFORTS };

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
// `strict: false` is for hooks: an older plugin copy must not refuse (and so fail open on) a key only a newer kit knows.
export function loadConfig(dir, { strict = true } = {}) {
  const file = join(dir, 'desk.config.json');
  let raw;
  try { raw = parseJson(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file}: ${e.message}`); }
  const abs = (p) => resolve(dir, p);
  // The allowed keys are the schema's properties: a typo is refused instead of silently ignored.
  const s = schema('desk-config'), allowed = (spec) => Object.keys(spec.properties);
  const refuse = (value, keys, where) => {
    if (!strict) return;
    const bad = Object.keys(value).find((k) => !keys.includes(k));
    if (bad !== undefined) throw new Error(`${file}: unknown key ${JSON.stringify(bad)} in ${where}; allowed: ${keys.join(', ')}`);
  };
  if (!isObject(raw)) throw new Error(`${file}: top level must be an object`);
  refuse(raw, allowed(s), 'the top level');
  if (raw.tasks !== undefined && !isObject(raw.tasks)) throw new Error(`${file}: tasks must be an object`);
  for (const [id, entry] of Object.entries(raw.tasks ?? {})) {
    if (!isObject(entry)) throw new Error(`${file}: tasks.${id} must be an object with only model and effort`);
    refuse(entry, Object.keys(ORDER), `tasks.${id}`);
  }
  const ids = new Set();
  const repos = (raw.repos ?? []).map((r, i) => {
    if (!isObject(r)) throw new Error(`${file}: repos[${i}] must be an object`);
    refuse(r, allowed(s.properties.repos.items), `repos[${i}]`);
    if (!SLUG.test(r.id ?? '') || ids.has(r.id)) throw new Error(`${file}: repos[${i}].id must be unique lowercase letters, digits and dashes`);
    if (!r.path) throw new Error(`${file}: repos[${i}] (${r.id}) has no path`);
    if (!KINDS.includes(r.kind ?? 'git')) throw new Error(`${file}: repos[${i}] (${r.id}) kind must be ${KINDS.join(' or ')}`);
    ids.add(r.id);
    const repo = { kind: 'git', gh: '', defaultBranch: 'main', branchPrefix: 'agent/', worktreePrefix: `${r.id}-`, install: '', build: '', check: '', merge: 'direct', ...r, path: abs(r.path) };
    if (repo.merge !== 'direct' && repo.merge !== 'review') throw new Error(`${file}: repos[${i}] (${r.id}) merge must be direct or review`);
    if (repo.merge === 'review' && repo.kind === 'folder') throw new Error(`${file}: repos[${i}] (${r.id}) merge "review" needs a git repo, not a plain folder`);
    // An empty prefix makes the branch the bare slug, which the merge guard could not tell from a protected branch.
    if (repo.merge === 'review' && !repo.branchPrefix) throw new Error(`${file}: repos[${i}] (${r.id}) merge "review" needs a non-empty branchPrefix`);
    // The guard protects what is outside the prefix, so the default branch must be outside it.
    if (repo.merge === 'review' && repo.defaultBranch.startsWith(repo.branchPrefix)) throw new Error(`${file}: repos[${i}] (${r.id}) merge "review" needs a defaultBranch outside branchPrefix: "${repo.defaultBranch}" starts with "${repo.branchPrefix}"`);
    return repo;
  });
  // A worktree folder name must say which repo it belongs to: no prefix may start another.
  const git = repos.filter((r) => r.kind === 'git');
  for (const a of git) for (const b of git) if (a !== b && b.worktreePrefix.startsWith(a.worktreePrefix))
    throw new Error(`${file}: worktreePrefix "${a.worktreePrefix}" (${a.id}) is a prefix of "${b.worktreePrefix}" (${b.id}); make them distinct`);
  if (raw.outputStyle !== undefined && typeof raw.outputStyle !== 'string') throw new Error(`${file}: outputStyle must be a string ("" leaves the output style alone)`);
  if (raw.harnesses !== undefined && !(Array.isArray(raw.harnesses) && raw.harnesses.length && raw.harnesses.every((h) => HARNESSES.includes(h)))) throw new Error(`${file}: harnesses must be a non-empty array of ${HARNESSES.join(' and ')}`);
  if (raw.floor !== undefined && !isObject(raw.floor)) throw new Error(`${file}: floor must be an object`);
  for (const [id, entry] of Object.entries(raw.floor ?? {})) {
    if (!isObject(entry) || Object.keys(entry).some((k) => !Object.hasOwn(ORDER, k))) throw new Error(`${file}: floor.${id} must be an object with only model and effort`);
  }
  for (const key of ['tasks', 'floor']) for (const [id, entry] of Object.entries(raw[key] ?? {})) for (const dim of ['model', 'effort']) {
    const accepted = ORDER[dim].filter((v) => key !== 'floor' || v !== 'fable');
    if (entry?.[dim] !== undefined && !accepted.includes(entry[dim])) throw new Error(`${file}: ${key}.${id}.${dim} must be one of ${accepted.join(', ')}`);
  }
  return { harnesses: ['claude'], permissions: {}, outputStyle: 'Concise', ...raw, home: dir, repos,
    worktreesDir: abs(raw.worktreesDir ?? '../worktrees'), scratchDir: abs(raw.scratchDir ?? 'scratch') };
}
// DESK_LENIENT=1 (set by the subagent-context hook before it imports the CLI) makes every config() read ignore unknown keys.
export const config = () => (cfg ??= loadConfig(deskHome(), { strict: !process.env.DESK_LENIENT }));

// The user file: a trust boundary, read and never written. Only allow-listed names get through, one bad
// value does not lose the others, and warnings name keys, never values (a pasted secret stays out of logs).
export const userSettingsPath = (env = process.env) => env.AGENT_DESK_SETTINGS ?? join(homedir(), '.agent-desk', 'settings.json');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const CACHE_KEYS = { promptCacheTtl: ['5m', '1h'], subagentPromptCacheTtl: ['5m', '1h'], idleCompaction: [true, false] };
export function readUserSettings(file) {
  const tasks = Object.create(null), cache = Object.create(null), warnings = [];
  const warn = (text) => warnings.push(`${file}: ${text}`), key = JSON.stringify;
  let raw;
  try {
    if (!file) return { tasks, cache, warnings };
    // The parser's message quotes the file's text, so it stays out of the warning.
    raw = parseJson(readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') warn(e instanceof SyntaxError ? 'not valid JSON, ignored' : `cannot be read (${e.code}), ignored`);
    return { tasks, cache, warnings };
  }
  if (!isObject(raw)) { warn('top level must be an object, ignored'); return { tasks, cache, warnings }; }
  for (const name of Object.keys(raw)) if (!['tasks', 'cache', '$schema'].includes(name)) warn(`unknown key ${key(name)}, ignored`);
  if (raw.tasks !== undefined && !isObject(raw.tasks)) warn('"tasks" must be an object, ignored');
  if (raw.cache !== undefined && !isObject(raw.cache)) warn('"cache" must be an object, ignored');
  for (const id of isObject(raw.tasks) ? Object.keys(raw.tasks) : []) {
    const entry = raw.tasks[id];
    if (!isObject(entry)) { warn(`tasks.${key(id)} must be an object, ignored`); continue; }
    const kept = {};
    for (const name of Object.keys(entry)) {
      if (!Object.hasOwn(ORDER, name)) warn(`tasks.${key(id)}: unknown key ${key(name)}, ignored`);
      else if (ORDER[name].includes(entry[name])) kept[name] = entry[name];
      else warn(`tasks.${key(id)}.${name} is not one of ${ORDER[name].join(', ')}, ignored`);
    }
    tasks[id] = kept;
  }
  for (const name of isObject(raw.cache) ? Object.keys(raw.cache) : []) {
    if (!Object.hasOwn(CACHE_KEYS, name)) warn(`cache: unknown key ${key(name)}, ignored`);
    else if (CACHE_KEYS[name].includes(raw.cache[name])) cache[name] = raw.cache[name];
    else warn(`cache.${name} is not one of ${CACHE_KEYS[name].join(', ')}, ignored`);
  }
  return { tasks, cache, warnings };
}

// The orchestrate skill's table is the one list of task ids and the kit layer: parsed, never copied, so
// the skill's fallback and the resolver cannot disagree. A row that does not parse is a kit bug: throw.
export function orchestrateTable(text = readFileSync(join(KIT, 'skills', 'orchestrate', 'SKILL.md'), 'utf8')) {
  const rows = (text.split('## Pick by task')[1] ?? '').split('\n## ')[0].split(/\r?\n/).filter((l) => l.startsWith('|')).slice(2);
  if (!rows.length) throw new Error('skills/orchestrate/SKILL.md: no task table');
  return rows.map((row) => {
    const [, task, , agent, model, effort] = row.split('|').map((s) => s.trim());
    if (!SLUG.test(task ?? '') || !/^`.+`$/.test(agent ?? '') || !MODELS.includes(model) || !EFFORTS.includes(effort)) throw new Error(`skills/orchestrate/SKILL.md: task row does not parse: ${row}`);
    return { task, agent: agent.slice(1, -1), model, effort };
  });
}

// Per value, last wins: kit, desk, user; then the floor raises what is below it and records what it replaced.
function resolveTask(row, c, user) {
  const out = { agent: row.agent, task: row.task, model: row.model, effort: row.effort, source: { model: 'kit', effort: 'kit' } };
  for (const dim of ['model', 'effort']) {
    for (const [source, layer] of [['desk', c.tasks?.[row.task]], ['user', user]]) if (layer?.[dim]) { out[dim] = layer[dim]; out.source[dim] = source; }
    const min = c.floor?.[row.task]?.[dim];
    if (min && ORDER[dim].indexOf(out[dim]) < ORDER[dim].indexOf(min)) { if (out.source[dim] === 'user') (out.replaced ??= {})[dim] = out[dim]; /* only what the user set */ out[dim] = min; out.source[dim] = 'floor'; }
  }
  return out;
}

// Never throws over the user file. `shared` is the resolution without the user layer: what todos may record.
export function resolveSettings(c, { env = process.env, file = userSettingsPath(env) } = {}) {
  const user = readUserSettings(file), warnings = [...user.warnings], table = orchestrateTable(), ids = new Set(table.map((r) => r.task));
  for (const [where, map] of [[`${file}: tasks`, user.tasks], ['desk.config.json: tasks', c.tasks], ['desk.config.json: floor', c.floor]])
    for (const id of Object.keys(map ?? {})) if (!ids.has(id)) warnings.push(`${where}: unknown task id ${JSON.stringify(id)}, ignored`);
  if (env.CLAUDE_CODE_EFFORT_LEVEL) warnings.push('CLAUDE_CODE_EFFORT_LEVEL is set: it overrides the resolved effort, floor included');
  if (env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE) warnings.push('CLAUDE_CODE_SUBAGENT_MODEL_FORCE is set: it overrides the resolved model, floor included');
  const tasks = {};
  for (const row of table) {
    const { model, effort } = resolveTask(row, c);
    tasks[row.task] = { ...resolveTask(row, c, user.tasks[row.task]), shared: { model, effort } };
  }
  const active = Object.keys(user.cache).length > 0 || table.some((r) => Object.keys(user.tasks[r.task] ?? {}).length > 0);
  return { userFile: file, active, tasks, cache: user.cache, warnings };
}

// What `desk status` shows of the user layer: null when none is active.
export function userLayer(s) {
  if (!s.active) return null;
  const all = Object.values(s.tasks), low = (t, dim) => ORDER[dim].indexOf(t[dim]) < ORDER[dim].indexOf(t.shared[dim]);
  return { file: s.userFile,
    below: all.filter((t) => low(t, 'model') || low(t, 'effort')).map(({ task, model, effort, shared }) => ({ task, model, effort, shared })),
    raised: all.filter((t) => t.replaced).map(({ task, model, effort, replaced }) => ({ task, model, effort, replaced })) };
}

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
