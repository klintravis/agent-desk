#!/usr/bin/env node
// Docs drift check: README.md (and openspec/inventory.md) against the code. No model, no dependencies.
// `node scripts/docs-check.mjs [<checkout>]` prints each gap and exits 1 if there is one.
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const lines = (s) => s.split(/\r?\n/);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A literal ending in a word char must not continue (`--json` is not `--json-x`).
const has = (text, tok) => new RegExp(esc(tok) + (/\w$/.test(tok) ? '(?![\\w-])' : '')).test(text);
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const slug = (h) => h.toLowerCase().replace(/`/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-');
const noComments = (s) => lines(s).filter((l) => !/^\s*\/\//.test(l)).join('\n');
// Drop fenced blocks and inline code.
const prose = (s) => { let fence = false; return lines(s).map((l) => /^\s*(```|~~~)/.test(l) ? (fence = !fence, '') : fence ? '' : l.replace(/`[^`]*`/g, '')).join('\n'); };
const FN = /^(?:export )?(?:async )?function (\w+)\(/gm;
// Top-level function: its line to the next line that is exactly `}` (a one-line function is its line).
function body(src, name) {
  const L = lines(src), i = L.findIndex((l) => new RegExp(`^(?:export )?(?:async )?function ${name}\\(`).test(l));
  if (i < 0) return null;
  if (!/\{\s*$/.test(L[i])) return L[i];
  const j = L.findIndex((l, k) => k > i && l === '}');
  return L.slice(i, j < 0 ? undefined : j).join('\n');
}
// shortcut: flags come from `flags(argv, X_FLAGS)`, `.includes/.indexOf('--x')` and `=== '--x'` in the handler and the
// same-file functions it calls (one level); a different parse style goes unseen, upgrade if one appears.
// Todo's flags are free-form (`--field value`): they cannot be listed from code, so the inventory holds them.
function flagsOf(src, fn) {
  const top = body(src, fn);
  if (top == null) return null;
  const callees = [...src.matchAll(FN)].map((m) => m[1]).filter((n) => n !== fn && !n.endsWith('Test') && new RegExp(`\\b${n}\\(`).test(top));
  const out = new Set();
  for (const b of [top, ...callees.map((n) => body(src, n))]) {
    for (const m of b.matchAll(/\bflags\(\s*\w+\s*,\s*(?:([A-Z_]+)|\[([^\]]*)\])\s*\)/g))
      for (const k of (m[2] ?? src.match(new RegExp(`const ${m[1]} = \\[([^\\]]*)\\]`))?.[1])?.match(/\w+/g) ?? []) out.add('--' + kebab(k));
    for (const m of b.matchAll(/(?:\.includes\(|\.indexOf\(|===\s*)'(--[\w-]+)'/g)) out.add(m[1]);
  }
  out.delete('--self-test');
  return [...out];
}

function commandsOf(src) {
  const m = /const COMMANDS = \{([\s\S]*?)\};/.exec(src);
  if (!m) return null;
  const out = [];
  const rest = m[1].replace(/(\w+)\s*:\s*lazy\(\s*'([^']+)'\s*,\s*'(\w+)'\s*\)/g, (_, cmd, f, fn) => (out.push({ cmd, file: `lib/${f}`, fn }), ''));
  for (const w of rest.split(',').map((x) => x.trim()).filter(Boolean)) {
    if (!/^\w+$/.test(w)) return null;
    out.push({ cmd: w, file: 'bin/desk.mjs', fn: w });
  }
  return out.length ? out : null;
}

// The cell after the leading `|`, up to the first ` | `, with `\|` unescaped.
const cellOf = (row) => { const r = row.slice(1), i = r.indexOf(' | '); return (i < 0 ? r : r.slice(0, i)).trim().replace(/\\\|/g, '|'); };
const tableRows = (text) => lines(text).filter((l) => l.startsWith('|') && !/^\|[-|: ]+$/.test(l));

export function gaps(root) {
  const out = [], rd = (f) => readFileSync(join(root, f), 'utf8');
  if (!existsSync(join(root, 'README.md'))) return [`README.md: missing in ${root}`];
  const md = ['README.md'];
  const min = existsSync(join(root, 'package.json')) ? /(\d+)/.exec(JSON.parse(rd('package.json')).engines?.node ?? '')?.[1] : undefined;
  for (const f of md) {
    const text = rd(f);
    for (const m of prose(text).matchAll(/\]\(([^)\s]+)/g)) {
      const h = m[1], p = h.replace(/[#?].*$/, '');
      if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('#') || !p) continue;
      if (!existsSync(join(root, dirname(f), p))) out.push(`${f}: broken link ${h}`);
    }
    for (const m of text.matchAll(/Node(?:\.js)? (\d+)(?: or (?:later|newer|above)|\+)/g))
      if (min && m[1] !== min) out.push(`${f}: says "${m[0]}", package.json engines say ${JSON.parse(rd('package.json')).engines.node}`);
  }
  if (!existsSync(join(root, 'bin/desk.mjs'))) return out;

  const bin = noComments(rd('bin/desk.mjs')), readme = rd('README.md'), inv = existsSync(join(root, 'openspec/inventory.md')) ? rd('openspec/inventory.md') : null;
  const cmds = commandsOf(bin);
  if (!cmds) return [...out, 'bin/desk.mjs: cannot parse `const COMMANDS = {...}`, so no command is checked'];
  const lits = [...(body(bin, 'main') ?? '').matchAll(/cmd === '([^']+)'/g)].map((m) => m[1]);
  const known = new Set([...cmds.map((c) => c.cmd), ...lits]);
  const srcs = {}; // file -> source without comment lines
  for (const d of ['bin', 'lib']) for (const f of readdirSync(join(root, d)).filter((x) => x.endsWith('.mjs'))) srcs[`${d}/${f}`] = noComments(rd(`${d}/${f}`));

  // README: the Commands table.
  const L = lines(readme), at = L.indexOf('## Commands');
  const end = L.findIndex((l, k) => k > at && l.startsWith('## '));
  const rows = tableRows(L.slice(at, end < 0 ? undefined : end).join('\n')).map((line) => {
    const cell = cellOf(line);
    return { line, toks: [...cell.matchAll(/`desk ([^\s`]+)([^`]*)`/g)].map((m) => ({ name: m[1], rest: m[2].trim() })).filter((t) => t.name !== '<command>'), anchors: [...line.matchAll(/\(#([\w-]+)\)/g)].map((m) => m[1]) };
  }).filter((r) => r.toks.length);
  const rowsOf = (c) => rows.filter((r) => r.toks.some((t) => t.name === c));
  const tabled = new Set(rows.flatMap((r) => r.toks.map((t) => t.name)));
  for (const c of known) if (!tabled.has(c)) out.push(`desk ${c}: in bin/desk.mjs, not in the Commands table of README.md`);
  for (const c of tabled) if (!known.has(c)) out.push(`desk ${c}: in the Commands table of README.md, not in bin/desk.mjs`);

  // Actions: `usage: desk <cmd> a|b|c` strings, against the second word of the command's cell.
  // shortcut: an action missing from the usage string goes unseen; upgrade if dispatch becomes a table.
  const actions = []; // [cmd, action, file]
  const usage = {}; // cmd -> { file, acts } over all its usage strings
  for (const [file, src] of Object.entries(srcs))
    for (const m of src.matchAll(/usage: desk (\w+) (\S+)/g)) {
      if (!m[2].includes('|')) continue;
      const u = (usage[m[1]] ??= { file, acts: new Set() });
      for (const a of m[2].split('|')) if (/^[\w-]+$/.test(a) && !a.startsWith('--') && !u.acts.has(a)) { u.acts.add(a); actions.push([m[1], a, file]); }
    }
  // The word lists after a command in its row(s): `a|b|c`, or one action per row.
  const docLists = (c) => rowsOf(c).flatMap((r) => r.toks.filter((t) => t.name === c).map((t) => t.rest.split(/\s/)[0].split('|')).filter((w) => w.every((x) => /^[\w-]+$/.test(x))));
  for (const [c, { file, acts }] of Object.entries(usage)) {
    const doc = docLists(c).flat();
    for (const a of acts) if (!doc.includes(a)) out.push(`desk ${c} ${a}: in ${file}, not in the Commands table of README.md`);
    for (const a of doc) if (!acts.has(a) && !a.startsWith('--')) out.push(`desk ${c} ${a}: in the Commands table of README.md, not in ${file}`);
  }
  // Without a usage string only a pipe list counts: one word may be a value, `--a|--b` are flags.
  for (const c of tabled) {
    const lists = known.has(c) && !usage[c] ? docLists(c).filter((w) => w.length > 1).map((w) => w.filter((x) => !x.startsWith('--'))).filter((w) => w.length) : [];
    if (lists.length) out.push(`desk ${c}: README.md lists actions ${lists.flat().join('|')}, but no usage string in bin/ or lib/ names them`);
  }

  // Flags: the code's flags are in the command's row or in a README section the row links.
  const heads = []; // [level, slug, line index]
  let fence = false;
  L.forEach((l, i) => { if (/^\s*(```|~~~)/.test(l)) fence = !fence; const h = !fence && /^(#+) (.*)/.exec(l); if (h) heads.push([h[1].length, slug(h[2]), i]); });
  const section = (a) => { const k = heads.findIndex((h) => h[1] === a); if (k < 0) return null; const n = heads.find((h, j) => j > k && h[0] <= heads[k][0]); return L.slice(heads[k][2], n?.[2]).join('\n'); };
  const flagMap = {};
  for (const { cmd, file, fn } of cmds) {
    if (cmd === 'todo') continue;
    const fl = srcs[file] ? flagsOf(srcs[file], fn) : null;
    if (!fl) { out.push(`desk ${cmd}: no function ${fn} in ${file}, flags not checked`); continue; }
    flagMap[cmd] = { fl, file };
    let docs = '';
    for (const r of rowsOf(cmd)) {
      docs += r.line + '\n';
      for (const a of r.anchors) { const s = section(a); if (s == null) out.push(`desk ${cmd}: README.md links #${a} in the Commands table, but no heading matches`); else docs += s + '\n'; }
    }
    for (const f of fl) if (!has(docs, f)) out.push(`desk ${cmd}: ${f} in ${file}, not in README.md`);
    for (const r of rowsOf(cmd)) for (const t of r.toks.filter((x) => x.name === cmd))
      for (const f of t.rest.match(/--[\w-]+/g) ?? []) if (f !== '--self-test' && !fl.includes(f)) out.push(`desk ${cmd}: ${f} in README.md, not in ${file}`);
  }

  if (!inv) return [...out, 'openspec/inventory.md: missing'];
  // Inventory: its literals are in README.md, and the code's items are in its first column.
  const first = tableRows(inv).map(cellOf).map((c) => /^`([^`]*)`/.exec(c)?.[1]).filter((x) => x != null);
  for (const lit of first) if (!has(readme, lit)) out.push(`${lit}: in openspec/inventory.md, not in README.md`);
  const items = new Set(first);
  for (const c of known) if (!items.has(`desk ${c}`)) out.push(`desk ${c}: in bin/desk.mjs, not in openspec/inventory.md`);
  for (const [c, a, file] of actions) if (!items.has(`${c} ${a}`)) out.push(`${c} ${a}: in ${file}, not in openspec/inventory.md`);
  for (const [c, { fl, file }] of Object.entries(flagMap)) for (const f of fl) if (!items.has(f)) out.push(`desk ${c} ${f}: in ${file}, not in openspec/inventory.md`);
  return out;
}

// realpath: a symlinked or junctioned install starts the script through another path.
const self = fileURLToPath(import.meta.url), real = (p) => { try { return realpathSync(p); } catch { return ''; } };
if (process.argv[1] && [resolve(process.argv[1]), real(process.argv[1])].includes(self)) {
  const g = gaps(resolve(process.argv[2] ?? '.'));
  console.log(g.length ? `docs-check: ${g.length} gap${g.length > 1 ? 's' : ''}` : 'docs-check: ok');
  for (const m of g) console.log(`- ${m}`);
  process.exit(g.length ? 1 : 0);
}
