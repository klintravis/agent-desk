// PreToolUse(Bash) settings hook: refuses shell-scripted file edits and points the agent at the Edit tool.
// The rule lives in hooks/editguard.mjs, shared with the mod's tool.call hook. Use this one where the
// mod is not loaded (a session without the plugin); with the plugin, the mod hook already guards.
// Reads the hook JSON on stdin. Exit 0 with no output = allow.   Usage: node edit-guard.mjs [--self-test]
import { readFileSync } from 'node:fs';
import { verdict, reason, CASES } from '../hooks/editguard.mjs';
import { findDesk } from '../lib/config.mjs';

if (process.argv[2] === '--self-test') {
  let bad = 0;
  for (const [c, want] of CASES) if (!!verdict(c) !== want) { bad++; console.error(`FAIL ${want ? 'should block' : 'should allow'}: ${c}`); }
  console.log(bad ? `${bad} failed` : `ok ${CASES.length} cases`);
  process.exit(bad ? 1 : 0);
}

let input;
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!findDesk(input?.cwd || process.cwd())) process.exit(0); // a desk rule: inert outside a desk
const why = verdict(input?.tool_input?.command || '');
if (!why) process.exit(0);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason(why) },
}));
