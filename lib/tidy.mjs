// `desk tidy [--apply] [--json]`: what finished work leaves behind. By default it only reports. --apply
// clears `owner` of proved-dead sessions, deletes proved orphans and raises one owner question for the rest.
// It never closes a todo and never writes board.jsonl. Deletion is final, so a path is only ever a validated
// slug plus a fixed suffix inside the streams or scratch folder: never a slug read from a todo or board line.
import { existsSync, lstatSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { SLUG, config, worktreeList, projectPrefixes, isDeskProject } from './config.mjs';
import { read, openClaims, todos, OPEN, nextId, writeTodo, clean } from '../bin/desk.mjs';
import { flags } from './wt.mjs';

const HOUR = 3600e3;
const DEAD_MS = 24 * HOUR; // a session away overnight must survive; also the age an orphan file must reach
const STALE_MS = 14 * 24 * HOUR;
const SCRATCH_SUFFIXES = ['-prompt.txt', '-run.jsonl', '-run.jsonl.err'];

// A real folder's entries; a missing folder or a link to one elsewhere counts as empty.
const list = (dir) => { try { return lstatSync(dir).isDirectory() ? readdirSync(dir, { withFileTypes: true }) : []; } catch { return []; } };
const hours = (ms) => Math.floor(ms / HOUR);

// Newest modification time per session id (first 8 characters, what `owner` holds). Names and times only.
function transcriptTimes(c) {
  const root = join(homedir(), '.claude', 'projects'), prefixes = projectPrefixes(c), newest = new Map();
  const see = (id, file) => { try { newest.set(id, Math.max(newest.get(id) ?? 0, statSync(file).mtimeMs)); } catch { /* gone since the listing */ } };
  for (const proj of list(root).filter((e) => e.isDirectory() && isDeskProject(prefixes, e.name))) {
    const dir = join(root, proj.name);
    for (const e of list(dir)) {
      if (e.isFile() && e.name.endsWith('.jsonl')) see(e.name.slice(0, 8), join(dir, e.name));
      else if (e.isDirectory()) for (const s of list(join(dir, e.name, 'subagents'))) if (s.isFile() && s.name.endsWith('.jsonl')) see(e.name.slice(0, 8), join(dir, e.name, 'subagents', s.name));
    }
  }
  return newest;
}

function owners(t, claims, times, now) {
  const dead = [], unknownOwners = [];
  for (const x of t.values()) {
    if (!OPEN.has(x.status) || !x.owner || x.owner === 'owner' || claims.some((c) => c.from === x.owner)) continue;
    const m = times.get(x.owner);
    if (m === undefined) unknownOwners.push({ id: x.id, owner: x.owner, title: x.title });
    else if (now - m >= DEAD_MS) dead.push({ id: x.id, owner: x.owner, title: x.title, hours: hours(now - m) });
  }
  return { dead, unknownOwners };
}

// The one place a candidate path is made: a regular file directly in `dir`, a valid slug, a fixed suffix.
function candidateFiles(dir, suffixes) {
  return list(dir).flatMap((e) => {
    const suffix = e.isFile() && suffixes.find((s) => e.name.endsWith(s));
    const slug = suffix ? e.name.slice(0, -suffix.length) : '';
    return SLUG.test(slug) ? [{ path: join(dir, slug + suffix), dir, slug }] : [];
  });
}

// shortcut: age is per file, so a `desk stream --desk` run past 24 hours with no todo can lose its prompt and idle .err, keep a slug's files together if streams run that long.
function orphans(c, t, lines, wtSlugs, now) {
  const wtsExist = existsSync(c.worktreesDir);
  const openSlugs = new Set([...t.values()].filter((x) => OPEN.has(x.status)).map((x) => x.slug));
  const history = new Set([...t.values()].map((x) => x.slug));
  for (const l of lines) { history.add(l.slug); if (typeof l.slug === 'string' && l.slug.startsWith('desk-')) history.add(l.slug.slice(5)); }
  const found = [], kept = [];
  for (const f of [...candidateFiles(join(c.home, 'streams'), ['.md']), ...candidateFiles(c.scratchDir, SCRATCH_SUFFIXES)]) {
    const keep = (reason) => kept.push({ file: f.path, slug: f.slug, reason });
    let m;
    try { m = lstatSync(f.path).mtimeMs; } catch { continue; } // gone since the listing
    if (!wtsExist) keep('worktrees folder missing: the absence of a worktree proves nothing');
    else if (wtSlugs.has(f.slug) || openSlugs.has(f.slug)) continue; // in use: normal, not listed
    else if (now - m < DEAD_MS) keep('modified less than 24 hours ago');
    else if (!history.has(f.slug)) keep("no board line or todo carries this slug: not provably the desk's own");
    else found.push({ file: f.path, dir: f.dir, slug: f.slug });
  }
  return { orphans: found, kept };
}

function candidates(t, lines, claims, wtSlugs, now) {
  const merged = new Set(lines.filter((l) => l.kind === 'merged').map((l) => l.slug));
  const out = [];
  for (const x of t.values()) {
    if (!OPEN.has(x.status)) continue;
    const kids = [...t.values()].filter((k) => k.parent === x.id);
    const old = now - Date.parse(x.updated) >= STALE_MS;
    const add = (kind, reason) => out.push({ id: x.id, title: x.title, kind, reason });
    if (x.slug && merged.has(x.slug) && !wtSlugs.has(x.slug)) add('finished', `slug ${x.slug} is merged and has no worktree`);
    else if (kids.length && !kids.some((k) => OPEN.has(k.status))) add('finished', 'all its children are closed');
    else if (x.area === 'watch') { if (old) add('watch', 'on watch, not updated for 14 days'); }
    else if (old && x.area !== 'owner' && x.area !== 'idea' && !kids.length && !claims.some((c) => c.slug === x.slug)) add('stale', 'not updated for 14 days');
  }
  return out;
}

// Refuses anything not directly inside its own folder, whatever built the path.
export function deleteOrphans(found, remove = unlinkSync) {
  return found.map((o) => {
    if (dirname(resolve(o.file)) !== resolve(o.dir)) return { action: 'failed', file: o.file, error: 'outside its folder, not deleted' };
    try { remove(o.file); return { action: 'deleted', file: o.file }; } catch (e) { return e.code === 'ENOENT' ? { action: 'deleted', file: o.file } : { action: 'failed', file: o.file, error: e.code ?? e.message }; } // ENOENT: another session's tidy got there first
  });
}

// shortcut: an add in the same instant can still take this id and be overwritten (same race as nextId), give todo.jsonl a lock if that ever happens.
function raiseQuestion(t, found) {
  const earlier = [...t.values()].filter((x) => x.source === 'tidy');
  if (earlier.some((x) => OPEN.has(x.status))) return [];
  const asked = new Set(earlier.flatMap((x) => String(x.tidyIds ?? '').split(',')));
  const fresh = found.filter((c) => !asked.has(c.id));
  if (!fresh.length) return [];
  const id = nextId(t), tidyIds = fresh.map((c) => c.id).join(',');
  // tidyIds holds every id: the list in why may be cut, so the options after it are not.
  const names = clean(fresh.map((c) => `${c.id} ${c.kind}`).join(', '), 800);
  writeTodo(id, { title: clean(`Tidy: ${fresh.length} ${fresh.length === 1 ? 'todo looks' : 'todos look'} finished, stale or forgotten`, 160), status: 'open', area: 'owner', size: 'small', source: 'tidy', tidyIds,
    summary: 'Review what desk tidy found',
    why: clean(`Close the ones that are over, one by one (desk tidy lists them): ${names}; Keep them all open, tidy will not ask about these again`, 1000) });
  return [{ action: 'raised', id, tidyIds }];
}

function textReport(r) {
  const section = (title, rows) => (rows.length ? [title, ...rows.map((s) => `  ${s}`)] : []);
  const out = [
    ...section('Dead owners (--apply clears them):', r.dead.map((d) => `${d.id} ${d.owner}, transcript ${d.hours}h old: ${d.title}`)),
    ...section('Unknown owners (no transcript found, never cleared):', r.unknownOwners.map((d) => `${d.id} ${d.owner}: ${d.title}`)),
    ...section('Orphan files (--apply deletes them):', r.orphans.map((o) => o.file)),
    ...section('Kept files:', r.kept.map((k) => `${k.file}: ${k.reason}`)),
    ...section('Review candidates (never closed; --apply asks the owner once):', r.candidates.map((x) => `${x.id} ${x.kind}, ${x.reason}: ${x.title}`)),
    ...section('Applied:', r.applied.map((a) => (a.action === 'cleared' ? `cleared owner of ${a.id} (${a.owner})` : a.action === 'deleted' ? `deleted ${a.file}` : a.action === 'raised' ? `raised ${a.id} for ${a.tidyIds}` : `could not delete ${a.file}: ${a.error}`))),
  ];
  return out.length ? out.join('\n') : 'Nothing to tidy.';
}

export function tidy(argv) {
  const { f, rest } = flags(argv, ['apply', 'json']);
  if (rest.length) throw new Error(`takes no arguments, got "${rest[0]}"`);
  // One snapshot before any write: a clear line resets `updated`, which must not hide a stale todo from this run's question.
  // The transcript walk comes first: it is slow, and a todo started or added during it must be in the snapshot.
  const c = config(), times = transcriptTimes(c), t = todos(), lines = read(), now = Date.now();
  const claims = openClaims(lines), wtSlugs = new Set(worktreeList(c).map((w) => w.slug));
  const report = { ...owners(t, claims, times, now), ...orphans(c, t, lines, wtSlugs, now), candidates: candidates(t, lines, claims, wtSlugs, now), applied: [] };
  if (f.apply) {
    for (const d of report.dead) {
      writeTodo(d.id, { owner: '', note: `tidy: cleared owner ${clean(d.owner, 40)}, transcript last written ${d.hours} hours ago` });
      report.applied.push({ action: 'cleared', id: d.id, owner: d.owner });
    }
    report.applied.push(...deleteOrphans(report.orphans), ...raiseQuestion(todos(), report.candidates));
  }
  console.log(f.json ? JSON.stringify(report, null, 2) : textReport(report));
}
