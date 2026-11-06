// `desk sync`: one source (the kit's skills/ and agents/, the desk's agent-rules.md and AGENTS.md)
// written in each harness's form. `desk workspace`: the VS Code .code-workspace (desk, repos, worktrees).
// The kit is the desk's pinned one (<desk>/node_modules/agent-desk), else the running one.
//   claude  -> <checkout>/.claude/settings.local.json for the desk folder, every repo checkout and open
//              worktree: DESK_HOME (worktrees cannot walk up to the desk), the permissions, the
//              SessionStart/SubagentStart context hooks and, in checkouts, the desk's own settings.json. GitHub Copilot reads the same files' hooks, so
//              these are the one hook source for both. Skills, agents and the mod reach Claude through
//              the agent-desk plugin, so none are copied.
//   copilot -> the desk folder only (VS Code finds customizations in open workspace folders; the desk is
//              one, and users' repos stay untouched): .github/skills/<name>/, .github/agents/<name>.agent.md,
//              and the desk's .claude/settings.local.json (for its hooks) even without the claude harness.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, cpSync, rmSync, renameSync, realpathSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname, basename, resolve } from 'node:path';
import { parseJson, config, worktreeList, gitRepos, deskKit, kitVersion, userSettingsPath, readUserSettings, resolveSettings, CACHE_KEYS } from './config.mjs';
import { appendJsonl, readJsonl, fold, nextId, clean, me, OPEN } from '../bin/desk.mjs';

const slash = (p) => p.replace(/\\/g, '/');
// Temp file then rename: a kill mid-write leaves the old file, not a truncated one (settings.local.json is gitignored).
// An existing file is written through its real path (a symlink stays one) and keeps its mode.
// When that fails (Windows refuses a rename onto a file another process holds open) a plain write still saves it.
export const writeJson = (file, obj) => {
  mkdirSync(dirname(file), { recursive: true });
  const target = existsSync(file) ? realpathSync(file) : file, tmp = `${target}.${process.pid}.tmp`, text = JSON.stringify(obj, null, 2) + '\n';
  // A failed temp write (disk full) throws: a plain write would truncate the real file and could fail too.
  try { writeFileSync(tmp, text, existsSync(target) ? { mode: statSync(target).mode } : undefined); }
  catch (e) { rmSync(tmp, { force: true }); throw e; }
  try { renameSync(tmp, target); }
  catch { rmSync(tmp, { force: true }); writeFileSync(target, text); }
};
// A file we merge into but cannot parse (JSONC comments, a typo) is left alone: rewriting it would lose the user's content.
const readJson = (file) => { try { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; } catch (e) { console.error(`warn ${file} is not plain JSON (${e.message}); not rewritten, fix or delete it and re-run`); return null; } };
const union = (...lists) => [...new Set(lists.flatMap((l) => l ?? []))];

// ---- Claude ----
const CONTEXT = 'subagent-context.mjs';
// Shell-neutral on purpose: Copilot runs `command` under bash and PowerShell alike. The desk and the
// checkout ride along: Copilot may not apply `env`, and only the checkout holding the session answers.
const contextHook = (c, dir, event) => [{ hooks: [{ type: 'command', command: `node "${slash(join(deskKit(c.home), 'scripts', CONTEXT))}" ${event} "${slash(c.home)}" "${slash(dir)}"`, timeout: 15 }] }];
const PERMS = ['allow', 'deny', 'ask', 'additionalDirectories'];

// A session opened in a checkout never reads the desk's own .claude/settings.json, so `carry` copies it
// there: its permissions, env, hooks and every other key (autoMode, enabledPlugins, cache TTLs, ...).
// Its hook commands run in the checkout: give them absolute paths, not $CLAUDE_PROJECT_DIR.
// null when it is not plain JSON: the caller must then write nothing (carrying {} would strip the guards).
const deskShared = (c) => readJson(join(c.home, '.claude', 'settings.json'));
const commands = (groups) => (groups ?? []).flatMap((g) => (g.hooks ?? []).map((h) => String(h.command ?? '')));
const plain = (v) => v && typeof v === 'object' && !Array.isArray(v);
// The record keeps key names one level deep, not values (env values may be secrets).
const shape = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, plain(v) ? Object.fromEntries(Object.keys(v).map((s) => [s, true])) : true]));
// Removes from `obj` what `was` (a shape) lists and `now` no longer has, one level deep; an emptied object key goes.
function dropStale(obj, was, now = {}) {
  const out = { ...obj };
  for (const [k, v] of Object.entries(plain(was) ? was : {})) {
    if (plain(v) && plain(out[k])) {
      const sub = { ...out[k] };
      for (const s of Object.keys(v)) if (!(plain(now[k]) && s in now[k])) delete sub[s];
      if (Object.keys(sub).length) out[k] = sub; else delete out[k];
    } else if (!(k in now)) delete out[k];
  }
  return out;
}

export function claudeSettings(c, dir = c.home, carry = dir !== c.home) {
  const p = c.permissions ?? {};
  const { permissions: dp = {}, hooks: dh = {}, env: de = {}, ...keys } = carry ? deskShared(c) ?? {} : {};
  const permissions = { ...dp, ...p }; // desk.config.json wins over the desk's settings.json
  for (const k of PERMS) { const l = union(dp[k], p[k]); if (l.length) permissions[k] = l; else delete permissions[k]; }
  // the desk's files (decisions, todos), the sibling worktrees and the plain folders are readable from any checkout
  permissions.additionalDirectories = union([c.home, c.worktreesDir, ...(c.repos ?? []).filter((r) => r.kind === 'folder').map((r) => r.path)],
    permissions.additionalDirectories).map(slash);
  // Edit rules cover every edit tool; on Windows an absolute path matches as //c/... with the drive in lower case.
  if ((c.repos ?? []).some((r) => r.merge === 'review')) permissions.deny = union(permissions.deny, [`Edit(/${slash(join(c.home, 'desk.config.json')).replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)})`]);
  const hooks = { ...dh };
  for (const e of ['SessionStart', 'SubagentStart']) hooks[e] = [...(dh[e] ?? []), ...contextHook(c, dir, e)];
  return { ...keys, ...(c.outputStyle ? { outputStyle: c.outputStyle } : {}), env: { ...de, DESK_HOME: c.home }, permissions, hooks };
}

// Keeps what the user added locally: other keys, other env vars, their permission entries (allow, deny,
// ask and directories are unions) and their own hooks; our hooks replace older copies of themselves.
// `prev` is what the desk wrote last time (permission entries, hook commands, the shape of the carried keys,
// env vars and other permission keys): what it wrote then and no longer writes goes.
export function mergeSettings(existing, ours, prev = {}) {
  const was = plain(prev?.carried) ? prev.carried : {};
  const gone = new Set(Array.isArray(prev?.hooks) ? prev.hooks : []), hooks = {};
  for (const event of new Set([...Object.keys(existing.hooks ?? {}), ...Object.keys(ours.hooks)])) {
    const mine = new Set(commands(ours.hooks[event]));
    // Only our hooks leave a group: a user hook sharing it (a formatter) stays.
    const theirs = (existing.hooks?.[event] ?? []).map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => {
      const cmd = String(h.command ?? '');
      return !cmd.includes(CONTEXT) && !mine.has(cmd) && !gone.has(cmd);
    }) })).filter((g) => g.hooks.length);
    const all = [...theirs, ...(ours.hooks[event] ?? [])];
    if (all.length) hooks[event] = all;
  }
  const e = dropStale(existing.permissions ?? {}, was.permissions, ours.permissions), o = ours.permissions;
  const permissions = { ...e, ...o };
  for (const k of PERMS) if (e[k] || o[k]) permissions[k] = union(o[k], (e[k] ?? []).filter((x) => !(Array.isArray(prev?.[k]) && prev[k].includes(x))));
  const { env, permissions: _p, hooks: _h, ...keys } = ours;
  const out = dropStale(existing, was.keys, keys);
  // Object keys merge one level (a plugin enabled locally stays enabled); ours win on the rest.
  for (const [k, v] of Object.entries(keys)) out[k] = plain(v) && plain(out[k]) ? { ...out[k], ...v } : v;
  return { ...out, env: { ...dropStale(existing.env ?? {}, was.env, env), ...env }, permissions, hooks };
}

// What the desk last wrote into the checkouts' permissions (gitignored: absolute paths).
const syncedFile = (c) => join(c.home, '.claude', 'synced-permissions.json');
const synced = (c) => { try { return JSON.parse(readFileSync(syncedFile(c), 'utf8')); } catch { return {}; } };

// The settings file of one checkout (or the desk); null when the claude harness is off or the file is not plain JSON.
export function syncCheckout(c, dir) {
  if (!c.harnesses.includes('claude') && dir !== c.home) return null;
  const file = join(dir, '.claude', 'settings.local.json');
  const existing = readJson(file);
  if (!existing) return null;
  const desk = dir === c.home;
  if (!desk && deskShared(c) === null) return null; // its warning is printed; the checkout keeps its guards
  if (existsSync(join(dir, '.git'))) excludeLocal(dir); // a desk nested in someone's repo must not edit that repo's exclude
  // The desk carries nothing into itself; its own record lists only what sync wrote there (outputStyle).
  const rec = synced(c), cache = userCache(c, dir, file);
  const prev = desk ? { ...rec, hooks: [], carried: rec.desk ?? {} } : rec;
  // A skipped file never got the user's keys: a name the record lists there is git's (committed), not ours to drop.
  const was = cache ? { ...prev, carried: { ...prev.carried, keys: { ...rec.user, ...prev.carried?.keys } } } : prev;
  writeJson(file, mergeSettings(existing, { ...claudeSettings(c, dir), ...cache }, was));
  return file;
}

// The user's cache keys, only where git can never pick the file up, else null: check-ignore also says no for a
// tracked file; 128 is a folder outside git. They are Claude Code's keys, so a Copilot-only desk gets none (T-87).
function userCache(c, dir, file, warn = (m) => console.error(`warn ${m}`)) {
  const { cache } = readUserSettings(userSettingsPath()), claude = c.harnesses.includes('claude');
  const { status } = spawnSync('git', ['-C', dir, 'check-ignore', '-q', '.claude/settings.local.json'], { stdio: 'ignore' });
  if (status === 0 || status === 128) return claude ? cache : {};
  if (claude && Object.keys(cache).length) warn(`${file}: not ignored by git, your cache settings were not written to it`);
  return null;
}

// An untracked settings file makes the checkout dirty, and `wt finish`/`merge` refuse a dirty one:
// ignore it in the clone's own info/exclude (shared by its worktrees), never in the repo's .gitignore.
function excludeLocal(dir) {
  const lines = ['.claude/settings.local.json', '.claude/settings.local.json.*.tmp']; // the file, and writeJson's temp file
  try {
    const common = execFileSync('git', ['-C', dir, 'rev-parse', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const f = join(resolve(dir, common), 'info', 'exclude');
    const cur = existsSync(f) ? readFileSync(f, 'utf8') : '';
    const missing = lines.filter((l) => !cur.split(/\r?\n/).includes(l));
    if (!missing.length) return;
    mkdirSync(dirname(f), { recursive: true });
    appendFileSync(f, `${cur && !cur.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`);
  } catch {} // git missing or broken: the settings file just shows as untracked
}

// ---- Copilot ----
// Claude agent frontmatter -> VS Code .agent.md (fields per code.visualstudio.com/docs/agents/reference/
// custom-agent-file-reference). `model` is dropped: Claude aliases (sonnet, opus) are not Copilot model
// ids; the picker's model applies. Tools map to Copilot's built-in aliases; unknown names are dropped.
const TOOLS = { Read: 'read', Grep: 'search', Glob: 'search', Bash: 'execute', Edit: 'edit', Write: 'edit', WebFetch: 'web', WebSearch: 'web', Agent: 'agent', Skill: 'read' };
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const l of m[1].split(/\r?\n/)) { const kv = /^([\w-]+):\s*(.*)$/.exec(l); if (kv) meta[kv[1]] = kv[2].trim(); }
  return { meta, body: text.slice(m[0].length) };
}
const q = (s) => JSON.stringify(s); // a JSON string is a valid YAML scalar
export function copilotAgent(text) {
  const { meta, body } = parseFrontmatter(text);
  const tools = meta.tools ? [...new Set(meta.tools.split(',').map((t) => TOOLS[t.trim()]).filter(Boolean))] : null;
  return ['---', `name: ${q(meta.name)}`, `description: ${q(meta.description ?? '')}`,
    ...(tools ? [`tools: [${tools.map(q).join(', ')}]`] : []),
    ...(meta.effort ? [`reasoning-effort: ${q(meta.effort)}`] : []),
    '---', '', body.trimStart()].join('\n');
}

// A desk skill or agent with a kit name is replaced by the kit's on every sync: name your own differently.
function syncCopilot(c) {
  const kit = deskKit(c.home), gh = join(c.home, '.github'), wrote = [];
  for (const name of readdirSync(join(kit, 'skills'))) {
    const to = join(gh, 'skills', name);
    rmSync(to, { recursive: true, force: true }); // a file dropped from the kit goes from the copy too
    cpSync(join(kit, 'skills', name), to, { recursive: true });
    wrote.push(join(to, 'SKILL.md'));
  }
  mkdirSync(join(gh, 'agents'), { recursive: true });
  for (const f of readdirSync(join(kit, 'agents')).filter((f) => f.endsWith('.md'))) {
    const to = join(gh, 'agents', f.replace(/\.md$/, '.agent.md'));
    writeFileSync(to, copilotAgent(readFileSync(join(kit, 'agents', f), 'utf8')));
    wrote.push(to);
  }
  // Earlier builds wrote a Copilot hooks file next to the settings hooks: Copilot would run both.
  rmSync(join(gh, 'hooks', 'agent-desk.json'), { force: true });
  return wrote;
}

// ---- commands ----
// Plain folders get no settings file: they are reached from the checkouts (additionalDirectories).
const checkouts = (c) => [...gitRepos(c).map((r) => r.path), ...worktreeList(c).map((w) => w.dir)];

export function sync(argv = []) {
  const c = config();
  const claude = c.harnesses.includes('claude'), copilot = c.harnesses.includes('copilot');
  const user = readUserSettings(userSettingsPath());
  for (const w of user.warnings) console.error(`warn ${w}`);
  const targets = claude ? [...new Set([c.home, ...(argv.length ? argv.map((a) => resolve(a)) : checkouts(c))])] : copilot ? [c.home] : [];
  for (const t of targets) {
    if (t !== c.home && !existsSync(join(t, '.git'))) { console.error(`skip ${t}: not a git checkout`); process.exitCode = 1; continue; }
    const f = syncCheckout(c, t);
    if (f) console.log(`claude  ${f}`); else process.exitCode = 1;
  }
  if (copilot) for (const f of syncCopilot(c)) console.log(`copilot ${f}`);
  if (claude) for (const r of c.repos.filter((x) => x.merge === 'review')) console.log(`merge   ${r.id}: review; edits to desk.config.json denied for Claude; protect ${r.defaultBranch} on the server`);
  writeShim(c.home);
  // Only a full sync that reached every checkout may move the records: a skipped one still holds the old entries.
  if (!process.exitCode && !argv.length) recordKitVersion(c);
  // Not gated on exitCode: a skipped checkout says nothing about the desk's own files.
  if (!argv.length) patchAgents(c.home);
  if (!process.exitCode && claude && !argv.length) {
    const { env, permissions, hooks, ...keys } = claudeSettings(c, c.home, true);
    const other = Object.fromEntries(Object.entries(permissions).filter(([k]) => !PERMS.includes(k)));
    writeJson(syncedFile(c), { ...Object.fromEntries(PERMS.map((k) => [k, permissions[k] ?? []])),
      hooks: Object.values(hooks).flatMap(commands).filter((x) => !x.includes(CONTEXT)),
      carried: { keys: shape(keys), env: shape(env), permissions: shape(other) },
      desk: { keys: c.outputStyle ? { outputStyle: true } : {} }, // the one carried key sync writes into the desk
      user: shape(user.cache) }); // shape: names, never the user's values
  }
  if (!argv.length) migrateDesk(c.home); // last: its both-files failure sets exitCode, which must not skip the writes above
  if (existsSync(workspaceFile(c))) workspace(); // hides the plumbing too
  else hidePlumbing(c);
}

// `desk settings [--json]`: what the layers resolve to and where each value came from. Writes nothing.
export function settings(argv = []) {
  const c = config(), s = resolveSettings(c), desk = deskShared(c) ?? {}, local = readJson(join(c.home, '.claude', 'settings.local.json')) ?? {};
  const cache = Object.fromEntries(Object.keys(CACHE_KEYS).map((k) => [k, k in s.cache ? { value: s.cache[k], source: 'user' } : k in desk ? { value: desk[k], source: 'desk' } : { value: null, source: 'unset' }]));
  const warnings = [...s.warnings];
  if (process.env.CLAUDE_CODE_PROMPT_CACHE_TTL) warnings.push('CLAUDE_CODE_PROMPT_CACHE_TTL is set: it takes precedence over promptCacheTtl');
  if (process.env.CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL) warnings.push('CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL is set: it takes precedence over subagentPromptCacheTtl');
  const file = join(c.home, '.claude', 'settings.local.json'), want = userCache(c, c.home, file, (m) => warnings.push(m)) ?? {}; // only what sync would write there
  for (const k of Object.keys(want)) if (local[k] !== want[k]) warnings.push(`cache.${k} is not applied yet: run desk sync`);
  if (c.harnesses.includes('copilot')) warnings.push('model and effort are advisory on Copilot: it may ignore them');
  if (argv.includes('--json')) { console.log(JSON.stringify({ userFile: s.userFile, active: s.active, tasks: s.tasks, cache, warnings })); return; }
  for (const w of warnings) console.error(`warn ${w}`);
  console.log(`user file: ${s.userFile}${s.active ? '' : ' (no values active)'}`);
  for (const t of Object.values(s.tasks)) console.log(`${t.task}: ${t.agent} ${t.model}/${t.effort} (model ${t.source.model}, effort ${t.source.effort}; shared ${t.shared.model}/${t.shared.effort})`);
  for (const [k, v] of Object.entries(cache)) console.log(`${k}: ${v.value ?? 'unset'} (${v.source})`);
  console.log('These apply through the orchestrate skill; an agent started outside it uses its own frontmatter or its caller\'s values.');
}

// `desk` (sh) in the desk folder: the desk's kit from any folder, no global install, and
// not `npx desk` (outside the desk that resolves the registry's `desk` package). Gitignored: absolute paths.
// A `desk` that is not ours (no marker, or a folder) is left alone with a warning. No `desk.cmd` any more
// (blocked by ThreatLocker): an old one we wrote is deleted, a foreign one warned about.
const SHIM_MARK = 'written by desk sync';
const sq = (s) => s.replace(/'/g, "'\\''"); // inside sh '...'
const isOurs = (f) => { try { return readFileSync(f, 'utf8').includes(SHIM_MARK); } catch { return false; } }; // EISDIR: a folder of that name
export function writeShim(home) {
  const kit = join(deskKit(home), 'bin', 'desk.mjs');
  const f = join(home, 'desk'), old = join(home, 'desk.cmd');
  if (existsSync(old)) {
    if (isOurs(old)) rmSync(old);
    else { console.error(`warn ${old} exists and is not the desk shim; not removed (the kit no longer writes it)`); }
  }
  if (existsSync(f) && !isOurs(f)) { console.error(`warn ${f} exists and is not the desk shim; not rewritten, rename it and re-run`); process.exitCode = 1; return []; }
  writeFileSync(f, `#!/bin/sh\n# ${SHIM_MARK}\nDESK_HOME='${sq(slash(home))}' exec node '${sq(slash(kit))}' "$@"\n`, { mode: 0o755 });
  return [f];
}

// ---- NEXT.md / TODO.md -> decisions.jsonl and watch todos (one-time, idempotent, full sync only) ----
const MIGRATED = ['Rulings recorded', 'Not yet verified live'];
// A `- ` bullet plus its continuation lines is one item; a section without bullets gives one per paragraph.
function items(lines) {
  const bullets = lines.some((l) => l.startsWith('- ')), out = [];
  let cur = null, dropped = false;
  for (const l of lines) {
    if (!l.trim()) cur = null;
    else if (l.startsWith('#')) { cur = null; dropped = true; } // any line starting with `#` (a ### subheading); it ends the item
    else if (l.startsWith('- ')) out.push(cur = [l.slice(2)]);
    else if (cur) cur.push(l);
    else if (!bullets) out.push(cur = [l]);
    else dropped = true; // a lead-in or second paragraph (a bulleted section's text outside any bullet): stays in the backup only
  }
  const res = out.map((p) => p.join(' ').replace(/\s+/g, ' ').trim());
  return Object.assign(res, { lossy: dropped || res.some((t) => clean(t, 1000) !== t) });
}
// -> { rulings: [{text, date?, todo?}], watch: [text], kept: [names of the sections left in NEXT.md.bak] }
export function parseNext(text) {
  const secs = [['preamble', []]];
  for (const l of text.split(/\r?\n/)) if (l.startsWith('## ')) secs.push([l.slice(3).trim(), []]); else secs.at(-1)[1].push(l);
  const sec = (name) => secs.find(([n]) => n === name)?.[1] ?? [];
  const ri = items(sec(MIGRATED[0])), wi = items(sec(MIGRATED[1]));
  const rulings = ri.map((t) => {
    // The prefix `desk decide` wrote; another desk's id inside a later ruling is not this desk's todo.
    const date = t.match(/\d{4}-\d{2}-\d{2}/)?.[0], todo = t.match(/^Owner, \d{4}-\d{2}-\d{2} \((T-\d+)\):/)?.[1];
    return { ...(date && { date }), ...(todo && { todo }), text: t };
  });
  // The preamble counts when it holds more than the `# ` title and one intro paragraph (a sha paragraph, say).
  const paras = (ls) => ls.filter((l) => !l.startsWith('# ')).join('\n').split(/\n\s*\n/).filter((p) => p.trim()).length;
  const kept = secs.filter(([n, ls]) => !MIGRATED.includes(n) && (n === 'preamble' ? paras(ls) > 1 : ls.some((l) => l.trim()))).map(([n]) => n);
  kept.push(...MIGRATED.filter((n, i) => [ri, wi][i].lossy));
  return { rulings, watch: [...wi], kept };
}

function migrateDesk(home) {
  const next = join(home, 'NEXT.md'), bak = `${next}.bak`, todoMd = join(home, 'TODO.md');
  if (existsSync(next) && existsSync(bak)) {
    console.error(`warn ${next} and ${bak} both exist; not migrated (a backup is never overwritten): merge or remove one and re-run`);
    process.exitCode = 1;
  }
  else if (existsSync(next)) {
    const { rulings, watch, kept } = parseNext(readFileSync(next, 'utf8'));
    const dFile = join(home, 'decisions.jsonl'), tFile = join(home, 'todo.jsonl'), ts = new Date().toISOString();
    // Compared as written (clean + limit): a run stopped before the rename repeats without duplicates.
    const rec = new Set(readJsonl(dFile).map((d) => d.text)), t = fold(readJsonl(tFile));
    const seen = new Set([...t.values()].filter((x) => x.area === 'watch').map((x) => x.why));
    let r = 0, w = 0;
    for (const { text: raw, ...f } of rulings) {
      const text = clean(raw, 1000);
      if (rec.has(text)) continue;
      appendJsonl(dFile, { ts, from: me(), ...f, text, source: 'NEXT.md' });
      rec.add(text); r++;
    }
    for (const raw of watch) {
      const why = clean(raw, 1000), id = nextId(t);
      if (seen.has(why)) continue;
      // Exactly one id: that todo is the subject. Several ids: no subject, so a new todo (moving one would be a guess).
      const named = [...new Set(raw.match(/\bT-\d+\b/g))], x = named.length === 1 ? t.get(named[0]) : null;
      if (x && OPEN.has(x.status) && !['owner', 'idea'].includes(x.area)) {
        // The note is the record: a second item for the same todo adds its own note, a re-run finds it and writes nothing.
        if (!x.notes.some((n) => n.endsWith(`: ${why}`))) {
          appendJsonl(tFile, { ts, from: me(), id: x.id, set: { area: 'watch', note: why } });
          // Named can also mean only cited: say so, with the way back.
          if (x.area !== 'watch') console.log(`moved ${x.id} to watch; if the item only cites it: desk todo set ${x.id} --area ${x.area}`);
          x.area = 'watch'; x.notes.push(`: ${why}`); w++;
        }
        seen.add(why); continue;
      }
      appendJsonl(tFile, { ts, from: me(), id, set: { title: clean(raw, 160), status: 'open', area: 'watch', size: 'small', why } });
      t.set(id, {}); seen.add(why); w++;
    }
    renameSync(next, bak);
    console.log(`migrated NEXT.md: ${r} rulings, ${w} watch todos${kept.length ? ` (NEXT.md.bak keeps: ${kept.join(', ')})` : ''}`);
  }
  if (!existsSync(todoMd)) return;
  // A desk folder can be a repo with its own TODO.md: only the generated one goes.
  const s = readFileSync(todoMd, 'utf8');
  if (s.startsWith('# Desk todos') && s.includes('Generated from `todo.jsonl`')) { rmSync(todoMd); console.log('removed TODO.md'); }
  else console.log('kept TODO.md: not generated by desk');
}

// The lines every shipped templates/AGENTS.md held that name NEXT.md / TODO.md -> the current template's line
// (same wrap points, so either version of the line between them still reads right).
export const AGENTS_PATCH = new Map([
  ['viewed in the generated `TODO.md`. A todo\'s area is a repo id, `desk` (desk tooling) or `owner`',
    'rulings in `decisions.jsonl`. A todo\'s area is a repo id, `desk` (desk tooling), `watch` (verify live) or `owner`'],
  ['**Start every session by reading `NEXT.md`** (shared state: rulings, not verified live) and',
    '**Start every session by reading the rulings** (`desk decide --list`), the watch todos and'],
  ['stopping, run the `handoff` skill: it writes only your own todos and your lines of `NEXT.md`.',
    'stopping, run the `handoff` skill: it writes only your own todos.'],
]);
function patchAgents(home) {
  const f = join(home, 'AGENTS.md');
  if (!existsSync(f)) return;
  const lines = readFileSync(f, 'utf8').split('\n');
  let n = 0;
  lines.forEach((l, i) => {
    const cr = l.endsWith('\r') ? '\r' : '', bare = l.slice(0, l.length - cr.length);
    if (AGENTS_PATCH.has(bare)) { lines[i] = AGENTS_PATCH.get(bare) + cr; n++; }
    else if (/NEXT\.md|TODO\.md/.test(bare)) console.log(`AGENTS.md:${i + 1} names NEXT.md/TODO.md: edit by hand`);
  });
  if (n) { writeFileSync(f, lines.join('\n')); console.log(`patched AGENTS.md: ${n} lines`); }
}

// kitVersion in desk.config.json is the kit the desk's files were last written with.
function recordKitVersion(c) {
  const file = join(c.home, 'desk.config.json'), raw = parseJson(readFileSync(file, 'utf8')), v = kitVersion(deskKit(c.home));
  if (raw.kitVersion === v) return;
  writeJson(file, { ...raw, kitVersion: v });
  console.log(`kitVersion ${raw.kitVersion ?? 'unset'} -> ${v} in ${file}`);
}

export const workspaceFile = (c) => join(c.home, `${basename(c.home)}.code-workspace`);
function workspaceJson(c) {
  return {
    folders: [{ name: 'desk', path: slash(c.home) },
      ...c.repos.map((r) => ({ name: r.id, path: slash(r.path) })),
      ...worktreeList(c).map((w) => ({ name: `wt ${w.slug} (${w.repo.id})`, path: slash(w.dir) }))],
    settings: {},
  };
}
// The kit's plumbing in the desk folder, hidden in VS Code (desk folder only: a workspace-level
// files.exclude would also hide package.json in the repos).
const HIDDEN = ['desk', 'node_modules', 'package.json', 'package-lock.json', '.github', '.claude', '.gitignore', '*.code-workspace', 'NEXT.md.bak'];
// Adds missing keys only: whatever the user set, `false` included, wins.
function hidePlumbing(c) {
  const file = join(c.home, '.vscode', 'settings.json'), s = readJson(file);
  if (!s) return; // settings.json is JSONC: warned by readJson, left alone, not a failure
  const ex = { ...s['files.exclude'] };
  const legacy = existsSync(join(c.home, '.claude', 'agent-rules.md')); // older desks edit their rules there
  const add = HIDDEN.filter((k) => !(k in ex) && !(legacy && k === '.claude'));
  if (!add.length) return;
  for (const k of add) ex[k] = true;
  writeJson(file, { ...s, 'files.exclude': ex });
}
// Keeps the user's settings/extensions blocks; the folder list is ours.
export function workspace() {
  const c = config(), file = workspaceFile(c);
  hidePlumbing(c);
  const existing = readJson(file);
  if (!existing) { process.exitCode = 1; return; }
  const ws = workspaceJson(c);
  writeJson(file, { ...ws, ...existing, folders: ws.folders });
  console.log(`wrote ${file}`);
}
