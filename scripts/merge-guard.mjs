// PreToolUse(Bash, PowerShell) hook: refuses pushes and merges into protected branches of a repo with
// merge "review". The rule lives in hooks/mergeguard.mjs; this finds the desk and maps each command's
// directory to a repo through its git common dir. Any error of its own allows: the server rule is the wall.
// A command it cannot read and that names push or merge, or has a backslash after $', is refused on any desk with a review repo.
// `desk sync` does not wire it, like edit-guard: the plugin's tool.call hook runs it; wire it by hand where
// the plugin is not loaded. Reads the hook JSON on stdin. Exit 0 with no output = allow.
// Usage: node merge-guard.mjs [--self-test]
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parse, judge, reason, verdict, CASES } from '../hooks/mergeguard.mjs';
import { findDesk, loadConfig } from '../lib/config.mjs';
import { samePath } from '../lib/wt.mjs';

if (process.argv[2] === '--self-test') {
  let bad = 0;
  for (const [c, current, want, shell] of CASES) {
    if (!!verdict(c, { current, shell }) !== want) { bad++; console.error(`FAIL ${want ? 'should refuse' : 'should allow'} on '${current}': ${c}`); }
  }
  console.log(bad ? `${bad} failed` : `ok ${CASES.length} cases`);
  process.exit(bad ? 1 : 0);
}

// What the shell would make of a path Node cannot read: ~, and Git Bash's /c/x on Windows.
function native(dir) {
  const d = dir.replace(/^~(?=$|[\\/])/, homedir());
  return process.platform === 'win32' ? d.replace(/^\/([a-zA-Z])(?=$|\/)/, '$1:') : d;
}

/** @returns {{ why: string, prefix: string, where?: string } | null} */
function refusal(op, cwd, review) {
  if (op.kind === 'unreadable') return { why: judge(op, review[0].branchPrefix), prefix: review[0].branchPrefix, where: 'this desk has a review repo' }; // a `cd` in it is unread too, so cwd does not say which repo
  if (op.dirs.includes(null)) return null; // a `cd $X`: not knowable here
  const dir = op.dirs.reduce((from, to) => resolve(from, native(to)), cwd);
  let repo;
  if (op.kind === 'gh' && op.repo) repo = review.find((r) => r.gh.toLowerCase() === op.repo.toLowerCase());
  else {
    const common = execFileSync('git', ['-C', dir, 'rev-parse', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
    const main = samePath(dirname(resolve(dir, common)));
    repo = review.find((r) => samePath(r.path) === main);
  }
  if (!repo) return null;
  // spawnSync: a detached head exits 1, and that is an answer, not an error.
  const current = op.kind === 'gh' ? '' : spawnSync('git', ['-C', dir, 'symbolic-ref', '-q', '--short', 'HEAD'], { encoding: 'utf8', timeout: 5000 }).stdout?.trim() ?? '';
  const why = judge(op, repo.branchPrefix, current);
  return why && { why, prefix: repo.branchPrefix };
}

function check(input) {
  const cwd = input?.cwd || process.cwd();
  // A subagent's worktree sits outside the desk: without DESK_HOME, the session's own folder finds it.
  const home = findDesk(cwd) ?? findDesk(process.cwd());
  if (!home) return null;
  const review = loadConfig(home).repos.filter((r) => r.merge === 'review');
  if (!review.length) return null; // a direct desk spawns no git
  for (const op of parse(input?.tool_input?.command || '', input?.tool_name)) {
    try { const r = refusal(op, cwd, review); if (r) return r; } catch {} // git failed here; the next command still counts
  }
  return null;
}

let hit = null;
try { hit = check(JSON.parse(readFileSync(0, 'utf8'))); } catch {}
if (hit) process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason(hit.why, hit.prefix, hit.where) },
}));
