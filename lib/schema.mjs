// The JSON Schemas of the desk files (schemas/) and a validator for the subset of JSON Schema they use.
// Hand-written on purpose: the kit has no dependencies. A keyword outside the subset throws, so a schema
// can never silently mean less here than in a standard validator.
// `desk check` reports what it finds as warnings: readers stay lenient (they skip a line that does not parse).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT, parseJson } from './config.mjs';

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
export function deskFileWarnings(home) {
  const out = [], max = 5;
  for (const [f, name] of Object.entries(SCHEMAS)) {
    const file = join(home, f);
    if (!existsSync(file)) continue;
    const s = schema(name), text = readFileSync(file, 'utf8');
    // desk.config.json is one document; the others hold one record per line.
    const docs = f.endsWith('.jsonl') ? text.split('\n').map((l, i) => [i + 1, l.trim()]).filter(([, l]) => l) : [[1, text]];
    const errs = [];
    for (const [n, l] of docs) {
      let v;
      try { v = parseJson(l); } catch { errs.push(`${f}:${n}: does not parse`); continue; }
      const e = validate(s, v);
      if (e.length) errs.push(`${f}:${n}: ${e[0]}`);
    }
    out.push(...errs.slice(0, max).map((e) => `warn ${e}`), ...(errs.length > max ? [`warn ${f}: +${errs.length - max} more`] : []));
  }
  return out;
}
