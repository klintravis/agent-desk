import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { KIT, BIN, env, multiDesk, desk, tmp } from './helpers.mjs';

const CTX = join(KIT, 'scripts', 'subagent-context.mjs');
const noDesk = () => ({ ...env(''), DESK_HOME: '' });
const run = (script, args, { cwd, envv, input }) => {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, env: envv, input, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const ctx = (home, ...args) => JSON.parse(run(CTX, args, { cwd: home, envv: env(home) }));

test('subagent-context: Claude form, Ponytail plus the desk rules, no board for subagents', () => {
  const { home } = multiDesk();
  const o = ctx(home, 'SubagentStart');
  assert.equal(o.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.match(o.hookSpecificOutput.additionalContext, /^PONYTAIL MODE ACTIVE - level: full/);
  assert.match(o.hookSpecificOutput.additionalContext, /# Desk rules for this agent/);
  assert.doesNotMatch(o.hookSpecificOutput.additionalContext, /Desk board/);
});

test('subagent-context: read-only agent types get the desk rules without Ponytail; others and unknown keep it', () => {
  const { home } = multiDesk();
  const as = (agent_type) => JSON.parse(run(CTX, ['SubagentStart'], { cwd: home, envv: env(home), input: JSON.stringify({ hook_event_name: 'SubagentStart', cwd: home, agent_type }) })).hookSpecificOutput.additionalContext;
  for (const t of ['agent-desk:validator', 'agent-desk:ci-triage', 'agent-desk:reviewer', 'Explore']) {
    const text = as(t);
    assert.match(text, /^# Desk rules for this agent/, t);
    assert.doesNotMatch(text, /PONYTAIL|Ponytail is active|lazy senior developer/, t);
    assert.match(text, /Board and todo text/, t);
  }
  for (const t of ['agent-desk:implementer', 'general-purpose', undefined]) assert.match(as(t), /^PONYTAIL MODE ACTIVE/, String(t));
});

test('subagent-context: PowerShell and cmd get the direct node form, which selects the desk from any folder', () => {
  const { home } = multiDesk();
  const text = ctx(home, 'SubagentStart').hookSpecificOutput.additionalContext;
  const mjs = join(KIT, 'bin', 'desk.mjs'); // no pinned kit in the test desk: the running one
  assert.ok(text.includes(`$env:DESK_HOME = '${home}'; node '${mjs}' ...`), 'PowerShell form');
  assert.ok(text.includes(`set "DESK_HOME=${home}" && node "${mjs}" ...`), 'cmd form');
  assert.doesNotMatch(text, /desk\.cmd/);
  const r = spawnSync(process.execPath, [mjs, 'home'], { cwd: tmp(), env: { ...process.env, DESK_HOME: home }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), home);
});

test('subagent-context: the PowerShell form single-quotes paths and doubles an apostrophe', () => {
  const home = join(tmp(), "it's $a"); // 'it''s $a' stays literal in PowerShell
  mkdirSync(home);
  assert.equal(spawnSync(process.execPath, [BIN, 'init', '--no-install'], { cwd: home, env: env(home), encoding: 'utf8' }).status, 0);
  const text = ctx(home, 'SubagentStart').hookSpecificOutput.additionalContext;
  assert.ok(text.includes(`$env:DESK_HOME = '${home.replace(/'/g, "''")}'; node '${join(KIT, 'bin', 'desk.mjs')}' ...`), text);
});

test('subagent-context: the concise rule for subagents only, and not when outputStyle is empty', () => {
  const { home } = multiDesk();
  const rule = /Reply concisely: lead with the result/;
  assert.match(ctx(home, 'SubagentStart').hookSpecificOutput.additionalContext, rule);
  assert.doesNotMatch(ctx(home, 'SessionStart').hookSpecificOutput.additionalContext, rule);
  const f = join(home, 'desk.config.json');
  writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, 'utf8')), outputStyle: '' }));
  assert.doesNotMatch(ctx(home, 'SubagentStart').hookSpecificOutput.additionalContext, rule);
});

test('subagent-context: SessionStart adds the board and the next todo per repo', () => {
  const { home } = multiDesk();
  assert.equal(desk(home, 'todo', 'add', 'first b job', '--area', 'b').status, 0);
  const c = ctx(home, 'SessionStart').hookSpecificOutput.additionalContext;
  assert.match(c, /# Desk board/);
  assert.match(c, /- a: nothing open\n- b: T-1 \[open\] first b job/);
});

test('subagent-context: the desk comes from the payload cwd (Claude or Copilot payload); Claude form out', () => {
  const { root, home } = multiDesk();
  const inRepo = join(root, 'a'), payloads = [
    { hook_event_name: 'SessionStart', session_id: 's', cwd: home, source: 'startup' }, // Claude
    { hookEventName: 'SessionStart', cwd: home, timestamp: 1, initialPrompt: '' }, // Copilot PascalCase alias
  ];
  for (const p of payloads) {
    const o = JSON.parse(run(CTX, [], { cwd: inRepo, envv: noDesk(), input: JSON.stringify(p) }));
    assert.equal(o.hookSpecificOutput.hookEventName, 'SessionStart', JSON.stringify(p));
    assert.match(o.hookSpecificOutput.additionalContext, /# Desk board/);
  }
});

test('subagent-context: <desk> <checkout> args; only the checkout holding the session answers', () => {
  const { root, home } = multiDesk();
  const a = join(root, 'a'), b = join(root, 'b'), base = { ...noDesk() };
  delete base.CLAUDE_PROJECT_DIR;
  const say = (cwd, envv = base) => run(CTX, ['SessionStart', home.replace(/\\/g, '/'), a.replace(/\\/g, '/')], { cwd: tmp(), envv, input: JSON.stringify({ hookEventName: 'SessionStart', cwd }) });
  assert.match(JSON.parse(say(join(a, 'sub'))).hookSpecificOutput.additionalContext, /# Desk board/, 'inside the checkout: the desk comes from the argument');
  if (process.platform === 'win32') assert.notEqual(say(a.toLowerCase()), '{}', 'VS Code hands out c:\\...: case-insensitive on Windows');
  assert.equal(say(b), '{}', 'another root of the workspace: silent');
  assert.notEqual(say(join(a, '..cache')), '{}', 'a ..cache subfolder is inside');
  assert.equal(say(join(a, '..')), '{}', 'the parent is outside');
  assert.match(JSON.parse(say(b, { ...base, CLAUDE_PROJECT_DIR: a })).hookSpecificOutput.additionalContext, /desk command .* is not on PATH/i,
    'Claude cd-ed into a sibling: its project dir decides');
});

test('subagent-context: outside a desk it prints {} and exits 0', () => {
  assert.equal(run(CTX, ['SessionStart'], { cwd: tmp(), envv: noDesk() }), '{}');
  assert.equal(run(CTX, [], { cwd: tmp(), envv: noDesk(), input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: tmp() }) }), '{}');
});

test('edit-guard: self-test cases, a deny for sed -i in a desk, inert outside one', () => {
  const g = join(KIT, 'scripts', 'edit-guard.mjs');
  assert.equal(spawnSync(process.execPath, [g, '--self-test'], { encoding: 'utf8' }).status, 0);
  const { home } = multiDesk();
  const guard = (cwd, command) => run(g, [], { cwd: tmp(), envv: noDesk(), input: JSON.stringify({ cwd, tool_input: { command } }) });
  assert.equal(JSON.parse(guard(home, "sed -i 's/a/b/' f")).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(guard(home, 'git status'), '');
  assert.equal(guard(tmp(), "sed -i 's/a/b/' f"), '', 'not a desk: not our rule');
});
