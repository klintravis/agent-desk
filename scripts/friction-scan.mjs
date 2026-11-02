// Scans Claude Code transcripts of the desk's sessions (desk, repos, worktrees, and their subagents)
// for workflow friction: tool errors, permission denials, oversized outputs, repeated commands.
// Usage: node friction-scan.mjs [--since <ISO time>] [--json]   (run in the desk, or set DESK_HOME)
// Prints a compact summary; the monitoring loop reads this instead of raw transcripts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { config, projectPrefixes, isDeskProject } from '../lib/config.mjs';

const args = process.argv.slice(2);
const since = args.includes('--since') ? Date.parse(args[args.indexOf('--since') + 1]) : Date.now() - 2 * 3600e3;
const root = join(homedir(), '.claude', 'projects');

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jsonl') && statSync(p).mtimeMs >= since) files.push(p);
  }
};
const prefixes = projectPrefixes(config());
for (const d of existsSync(root) ? readdirSync(root) : []) if (isDeskProject(prefixes, d)) walk(join(root, d));

const clip = (s, n = 160) => String(s).replace(/\s+/g, ' ').slice(0, n);
const findings = [];
const cmdCount = new Map();
for (const f of files) {
  const who = f.slice(root.length + 1).replace(/\\/g, '/').replace(/\.jsonl$/, '');
  const uses = new Map(); // tool_use_id -> {name, input}
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.timestamp && Date.parse(r.timestamp) < since) continue;
    const content = Array.isArray(r.message?.content) ? r.message.content : [];
    for (const c of content) {
      if (c.type === 'tool_use') {
        uses.set(c.id, c);
        const cmd = c.input?.command;
        if (cmd) { const k = `${who}\u0000${cmd}`; cmdCount.set(k, (cmdCount.get(k) || 0) + 1); }
      } else if (c.type === 'tool_result') {
        const u = uses.get(c.tool_use_id);
        const text = typeof c.content === 'string' ? c.content : (c.content || []).map((x) => x.text || '').join(' ');
        const tool = u ? `${u.name}: ${clip(u.input?.command || u.input?.file_path || u.input?.description || '', 90)}` : '?';
        // Anchored: a denial is the whole result, not text quoted inside other output (e.g. this scan's own report).
        if (/^\s*(Permission for this action was denied|Permission to use .* has been denied)/i.test(text)) findings.push(['DENIED', who, tool, clip(text)]);
        else if (c.is_error) findings.push(['ERROR', who, tool, clip(text)]);
        // 20–30KB whole-file reads of guard sources are normal for implementers; flag only beyond that.
        if (text.length > 30000) findings.push(['BIG-OUTPUT', who, tool, `${text.length} chars`]);
      }
    }
  }
}
for (const [k, n] of cmdCount) if (n >= 3) { const [who, cmd] = k.split('\u0000'); findings.push(['REPEATED', who, clip(cmd, 120), `${n}x`]); }

if (args.includes('--json')) { console.log(JSON.stringify({ since: new Date(since).toISOString(), files: files.length, findings })); process.exit(0); }
console.log(`friction-scan since ${new Date(since).toISOString()}: ${files.length} transcripts, ${findings.length} findings`);
const order = ['DENIED', 'ERROR', 'REPEATED', 'BIG-OUTPUT'];
for (const kind of order) {
  const fs_ = findings.filter((x) => x[0] === kind);
  if (!fs_.length) continue;
  console.log(`\n## ${kind} (${fs_.length})`);
  for (const [, who, tool, detail] of fs_.slice(0, 15)) console.log(`- ${who.split('/').slice(-1)[0].slice(0, 22)} | ${tool} | ${detail}`);
  if (fs_.length > 15) console.log(`- ... ${fs_.length - 15} more`);
}
