// The JSON Schemas of the desk files (schemas/) and a validator for the subset of JSON Schema they use.
// Hand-written on purpose: the kit has no dependencies. A keyword outside the subset throws, so a schema
// can never silently mean less here than in a standard validator.
// `desk check` reports what it finds as warnings: readers stay lenient (they skip a line that does not parse).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT } from './config.mjs';

const KEYWORDS = new Set(['$schema', '$id', 'title', 'description', 'type', 'required', 'properties', 'additionalProperties', 'items', 'enum', 'const', 'pattern', 'minLength']);
const TYPES = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v), array: Array.isArray, string: (v) => typeof v === 'string',
  integer: Number.isInteger, number: (v) => typeof v === 'number', boolean: (v) => typeof v === 'boolean', null: (v) => v === null,
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Returns `<path>: <message>` strings, empty when valid; path `/` is the value itself.
export function validate(s, v, path = '') {
  const bad = Object.keys(s).filter((k) => !KEYWORDS.has(k));
  if (bad.length) throw new Error(`schema keyword not supported: ${bad.join(', ')}`);
  const at = (m) => `${path || '/'}: ${m}`;
  if (s.type) {
    const types = [].concat(s.type);
    for (const t of types) if (!TYPES[t]) throw new Error(`schema type not supported: ${t}`);
    if (!types.some((t) => TYPES[t](v))) return [at(`must be ${types.join(' or ')}`)];
  }
  const out = [];
  if ('const' in s && !same(s.const, v)) out.push(at(`must be ${JSON.stringify(s.const)}`));
  if (s.enum && !s.enum.some((e) => same(e, v))) out.push(at(`must be one of ${s.enum.join(', ')}`));
  if (typeof v === 'string') {
    if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) out.push(at(`must match ${s.pattern}`));
    if (s.minLength !== undefined && [...v].length < s.minLength) out.push(at(`must have at least ${s.minLength} characters`));
  }
  if (TYPES.object(v)) {
    for (const k of s.required ?? []) if (!(k in v)) out.push(at(`missing ${k}`));
    for (const [k, x] of Object.entries(v)) {
      const sub = Object.hasOwn(s.properties ?? {}, k) ? s.properties[k] : s.additionalProperties;
      if (sub === false) out.push(at(`unknown field ${k}`));
      else if (TYPES.object(sub)) out.push(...validate(sub, x, `${path}/${k}`));
    }
  }
  if (Array.isArray(v) && s.items) v.forEach((x, i) => out.push(...validate(s.items, x, `${path}/${i}`)));
  return out;
}

export const SCHEMAS = { 'desk.config.json': 'desk-config', 'todo.jsonl': 'todo', 'board.jsonl': 'board', 'decisions.jsonl': 'decisions' };
export const schema = (name, kit = KIT) => JSON.parse(readFileSync(join(kit, 'schemas', `${name}.schema.json`), 'utf8'));

// `warn <file>:<line>: <first error>` per bad line of the desk's files, at most `max` per file. A missing file is skipped.
export function deskFileWarnings(home, kit = KIT, max = 5) {
  const out = [];
  for (const [f, name] of Object.entries(SCHEMAS)) {
    const file = join(home, f);
    if (!existsSync(file)) continue;
    const s = schema(name, kit), text = readFileSync(file, 'utf8');
    // desk.config.json is one document; the others hold one record per line.
    const docs = f.endsWith('.jsonl') ? text.split('\n').map((l, i) => [i + 1, l.trim()]).filter(([, l]) => l) : [[1, text]];
    const errs = [];
    for (const [n, l] of docs) {
      let v;
      try { v = JSON.parse(l); } catch { errs.push(`${f}:${n}: does not parse`); continue; }
      const e = validate(s, v);
      if (e.length) errs.push(`${f}:${n}: ${e[0]}`);
    }
    out.push(...errs.slice(0, max).map((e) => `warn ${e}`), ...(errs.length > max ? [`warn ${f}: +${errs.length - max} more`] : []));
  }
  return out;
}

// Walks every shipped schema (an unsupported keyword throws) and checks the validator on known cases.
export function schemaTest(kit = KIT) {
  const s = Object.fromEntries([...Object.values(SCHEMAS), 'desk-status'].map((n) => [n, schema(n, kit)])); // desk-status is output, not a desk file
  const walk = (x) => { validate(x, undefined); for (const sub of [...Object.values(x.properties ?? {}), x.items, x.additionalProperties]) if (TYPES.object(sub)) walk(sub); };
  const ts = '2026-11-01T00:00:00.000Z';
  return [
    Object.values(s).every((x) => (walk(x), true)),
    (() => { try { validate({ minimum: 1 }, 1); return false; } catch { return true; } })(), // unknown keyword
    validate(s.todo, { v: 1, ts, from: 'aaaa', id: 'T-1', set: { title: 'a', status: 'open', area: 'desk', size: 'small', prio: 3, any: 'x' } }).length === 0,
    validate(s.todo, { ts, from: 'aaaa', id: 'T-1', set: { status: 'done', note: 'x' } }).length === 0, // an old line without v
    validate(s.todo, { v: 1, ts, from: 'aaaa', id: 'T1', set: { status: 'later', prio: 1.5 } }).join() === '/id: must match ^T-\\d+$,/set/status: must be one of open, active, blocked, done, dropped,/set/prio: must be integer or null',
    validate(s.board, { v: 1, ts, from: 'aaaa', kind: 'claim', slug: 'a-b', text: '', repo: 'kit' }).length === 0,
    validate(s.board, { ts, from: 'aaaa', kind: 'claim', slug: 'A b', extra: 1 }).join() === '/slug: must match ^[a-z0-9][a-z0-9-]*$,/: unknown field extra',
    validate(s.decisions, { v: 1, ts, from: 'aaaa', date: '2026-11-01', todo: 'T-40', title: 't', text: 'drop it' }).length === 0,
    validate(s.decisions, { v: 2, ts, from: 'aaaa', text: '' }).join() === '/v: must be 1,/text: must have at least 1 characters',
    validate(s['desk-config'], { repos: [{ id: 'kit', path: '../kit', kind: 'git' }], harnesses: ['claude'], custom: 1 }).length === 0,
    validate(s['desk-config'], { repos: [{ id: 'Kit' }] }).join() === '/repos/0: missing path,/repos/0/id: must match ^[a-z0-9][a-z0-9-]*$',
    validate(s.todo, []).join() === '/: must be object',
    validate(s['desk-status'], { v: 1, at: ts, decisions: [], active: [], claims: [], sessions: null, roots: [], branches: [], prs: null, overlaps: null, tokens: null, text: '' }).length === 0,
    validate(s['desk-status'], { v: 1, at: ts, decisions: [{ id: 'T-1' }], active: [], claims: [], sessions: [], roots: [], branches: [], prs: [], overlaps: [], tokens: null, text: '' }).join() === '/decisions/0: missing title',
  ];
}
