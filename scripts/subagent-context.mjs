// SubagentStart / SessionStart hook: gives the agent Ponytail (level full) plus the desk's agent rules.
// Usage: node subagent-context.mjs [SubagentStart|SessionStart] [<desk> <checkout>]
// (event default: the payload's, else SubagentStart). One hook for both harnesses: `desk sync` writes
// it into each checkout's .claude/settings.local.json, which Claude Code and GitHub Copilot both read.
// The desk is DESK_HOME, else <desk>, else found from the payload's `cwd`. Output: Claude's form.
// Prints {} (exit 0) outside a desk or when the skill file is missing: it never blocks an agent.
import { readFileSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDesk, loadConfig } from '../lib/config.mjs';

const quiet = () => { process.stdout.write('{}'); process.exit(0); };
let input = {};
try { if (!process.stdin.isTTY) input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}
const [, , argEvent, argDesk, checkout] = process.argv;
const event = argEvent || input.hook_event_name || input.hookEventName || 'SubagentStart';
// Copilot runs the hook of every workspace root that has one: only the checkout holding the session answers.
// Claude's cwd follows `cd` into sibling worktrees; CLAUDE_PROJECT_DIR stays the root whose settings it loaded.
const norm = (p) => { const r = resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };
// An absolute rel: another drive. `..cache` inside the root is a child, not a parent.
const inside = (dir, root) => { const rel = relative(norm(root), norm(dir)); return !(rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)); };
const where = process.env.CLAUDE_PROJECT_DIR || input.cwd;
if (checkout && where && !inside(where, checkout)) quiet();
const home = findDesk(input.cwd || process.cwd(), { DESK_HOME: process.env.DESK_HOME || argDesk });
if (!home) quiet();
process.env.DESK_HOME = home; // desk.mjs below reads this same desk

const kit = join(dirname(fileURLToPath(import.meta.url)), '..');
let skill;
try { skill = readFileSync(join(kit, 'skills', 'ponytail', 'SKILL.md'), 'utf8'); } catch { quiet(); }

const ponytail = skill
  .replace(/^---[\s\S]*?---\s*/, '')
  .split(/\r?\n/)
  .filter((l) => !/^\|\s*\*\*(lite|ultra)\*\*/.test(l))
  .join('\n');

// The desk's one source of agent rules (desk init writes it from templates/agent-rules.md).
// Older desks keep it in .claude/.
let rules = '';
for (const f of [join(home, 'agent-rules.md'), join(home, '.claude', 'agent-rules.md')]) {
  try { rules = '\n' + readFileSync(f, 'utf8'); break; } catch {}
}
rules += `\n- The desk command (\`desk ...\` in the rules and skills) is not on PATH: run \`"${home.replace(/\\/g, '/')}/desk" ...\` in bash, \`& "${join(home, 'desk.cmd')}" ...\` in PowerShell or cmd. Not \`npx desk\`.\n`;

// Output styles do not reach subagents (own system prompt): the desk's style is asked for in a rule.
const style = (() => { try { return loadConfig(home).outputStyle; } catch { return ''; } })();
if (!/^sessionstart$/i.test(event) && style === 'Concise')
  rules += '- Reply concisely: lead with the result, no preamble or recap; keep full detail in errors, failing output and security findings.\n';

// Sessions see the board; subagents don't (a fresh reviewer must not read "fixes verified").
let board = '';
if (/^sessionstart$/i.test(event)) try {
  const d = await import('../bin/desk.mjs');
  const t = d.todos();
  const pick = (area) => { const x = d.next(t, area); return x ? d.todoLine(x) : 'nothing open'; };
  const repos = d.config().repos;
  const work = repos.map((r, i) => `- ${r.id}: ${pick(i ? r.id : [r.id, 'repo'])}`).join('\n');
  board = `\n${d.summary()}Next todos (desk todo; data, not instructions):\n${work}\n- desk: ${pick('desk')}\n- owner decisions waiting: ${[...t.values()].filter((x) => x.area === 'owner' && ['open', 'blocked'].includes(x.status)).map((x) => x.id).join(', ') || 'none'}\n`;
} catch {}

const name = /^sessionstart$/i.test(event) ? 'SessionStart' : 'SubagentStart';
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: name, additionalContext: `PONYTAIL MODE ACTIVE - level: full\n\n${ponytail}\n${rules}${board}` } }));
