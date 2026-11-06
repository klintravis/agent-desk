import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, rmSync, renameSync, chmodSync, statSync, symlinkSync, lstatSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { copilotAgent, parseFrontmatter, claudeSettings, mergeSettings, AGENTS_PATCH, parseNext, writeShim, writeJson } from '../lib/sync.mjs';
import { ghName } from '../lib/init.mjs';
import { fold } from '../bin/desk.mjs';
import { multiDesk, desk, git, tmp, KIT, BIN, env, ok, setRepo } from './helpers.mjs';

const KIT_VERSION = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')).version;

test('copilotAgent: name, description, mapped tools, effort; model dropped', () => {
  const out = copilotAgent('---\nname: rev\ndescription: Reads: the "branch"\nmodel: opus\neffort: high\ntools: Read, Grep, Glob, Bash, Bogus\n---\n\nBody text.\n');
  const { meta, body } = parseFrontmatter(out);
  assert.equal(JSON.parse(meta.name), 'rev');
  assert.equal(JSON.parse(meta.description), 'Reads: the "branch"');
  assert.equal(meta.tools, '["read", "search", "execute"]');
  assert.equal(JSON.parse(meta['reasoning-effort']), 'high');
  assert.equal(meta.model, undefined);
  assert.equal(body.trim(), 'Body text.');
});

test('every kit agent converts with a name and a description', () => {
  for (const f of readdirSync(join(KIT, 'agents'))) {
    const { meta } = parseFrontmatter(copilotAgent(readFileSync(join(KIT, 'agents', f), 'utf8')));
    assert.ok(JSON.parse(meta.name) && JSON.parse(meta.description), f);
  }
});

test('ci-triage cannot edit: Claude tools and their Copilot form', () => {
  const src = readFileSync(join(KIT, 'agents', 'ci-triage.md'), 'utf8');
  const { meta } = parseFrontmatter(src);
  assert.equal(meta.tools, 'Read, Grep, Glob, Bash');
  assert.equal(meta.model, 'haiku');
  assert.equal(meta.effort, 'low');
  assert.deepEqual(JSON.parse(parseFrontmatter(copilotAgent(src)).meta.tools), ['read', 'search', 'execute']);
});

test('structure-reviewer cannot edit and loads the condensed rubric; the vendored one stays invocable', () => {
  const src = readFileSync(join(KIT, 'agents', 'structure-reviewer.md'), 'utf8');
  const { meta, body } = parseFrontmatter(src);
  assert.equal(meta.tools, 'Read, Grep, Glob, Bash, Skill');
  assert.deepEqual([meta.model, meta.effort], ['opus', 'medium']);
  assert.ok(!JSON.parse(parseFrontmatter(copilotAgent(src)).meta.tools).includes('edit'));
  assert.match(body, /`structure-rubric` skill/);
  assert.match(readFileSync(join(KIT, 'skills', 'structure-rubric', 'SKILL.md'), 'utf8'), /^## Presumptive blockers$/m);
  assert.doesNotMatch(body, /desk board post/);
  const rubric = parseFrontmatter(readFileSync(join(KIT, 'skills', 'thermo-nuclear-code-quality-review', 'SKILL.md'), 'utf8')).meta;
  assert.equal(rubric.name, 'thermo-nuclear-code-quality-review');
  assert.equal(rubric['disable-model-invocation'], undefined);
});

test('only the report skills and grill are slash-only', () => {
  const dir = join(KIT, 'skills');
  const off = readdirSync(dir).filter((n) => String(parseFrontmatter(readFileSync(join(dir, n, 'SKILL.md'), 'utf8')).meta['disable-model-invocation']) === 'true');
  assert.deepEqual(off.sort(), ['grill', 'ponytail-audit', 'ponytail-debt']);
});

test('the grill skill stays within its byte budget', () => {
  assert.ok(statSync(join(KIT, 'skills', 'grill', 'SKILL.md')).size <= 2560);
});

test('handoff, kickoff and orchestrate all use context/T-n.md', () => {
  for (const n of ['handoff', 'kickoff', 'orchestrate']) assert.match(readFileSync(join(KIT, 'skills', n, 'SKILL.md'), 'utf8'), /context\/T-n\.md/, n);
});

test('stack-lens: every lens in the table has a build and a review file, and no stray file', () => {
  const dir = join(KIT, 'skills', 'stack-lens');
  const listed = [...readFileSync(join(dir, 'SKILL.md'), 'utf8').matchAll(/^\| ([a-z]+) \| /gm)].map((m) => m[1]).filter((l) => l !== 'Lens');
  assert.deepEqual(readdirSync(join(dir, 'lenses')).sort(), listed.flatMap((l) => [`${l}.build.md`, `${l}.review.md`]).sort());
  for (const f of readdirSync(join(dir, 'lenses'))) assert.ok(readFileSync(join(dir, 'lenses', f), 'utf8').trim().split('\n').length > 3, f);
  assert.match(readFileSync(join(KIT, 'agents', 'implementer.md'), 'utf8'), /`stack-lens` skill[\s\S]{0,120}build files/);
  assert.match(readFileSync(join(KIT, 'agents', 'reviewer.md'), 'utf8'), /`stack-lens` skill and check the review file/);
});

test('validator: proves claims through the validate skill, edits no code, posts no verdict', () => {
  const { meta, body } = parseFrontmatter(readFileSync(join(KIT, 'agents', 'validator.md'), 'utf8'));
  assert.equal(meta.tools, 'Read, Grep, Glob, Bash, Write, Skill');
  assert.deepEqual([meta.model, meta.effort], ['sonnet', 'medium']);
  assert.match(body, /`validate` skill/);
  assert.match(body, /desk board post verdict <slug> "FIXES NEEDED @<head sha> validation:/);
  const skill = ['SKILL.md', 'proving.md'].map((f) => readFileSync(join(KIT, 'skills', 'validate', f), 'utf8')).join('\n');
  for (const v of ['VERIFIED', 'NOT VERIFIED', 'INCONCLUSIVE', 'accept: <claim> | <command> | <expected>', 'worktree remove --force']) assert.ok(skill.includes(v), v);
});

test('approaches: fix and refactor end in Done when; only the refactor skill overrides Ponytail; the kind table is the one source', () => {
  const read = (n) => readFileSync(join(KIT, 'skills', n, 'SKILL.md'), 'utf8');
  for (const n of ['fix', 'refactor']) assert.match(read(n), /^## Done when$/m, n);
  assert.match(read('refactor'), /replaces two Ponytail rules/);
  assert.doesNotMatch(read('fix'), /replaces .*Ponytail/);
  assert.doesNotMatch(readFileSync(join(KIT, 'templates', 'agent-rules.md'), 'utf8'), /refactor/, 'every subagent loads agent-rules: the override stays in the refactor skill');
  const o = read('orchestrate');
  const kinds = o.slice(o.indexOf('## Approach by kind'), o.indexOf('## Parallel or sequential'));
  for (const k of ['fix:', 'feature:', 'refactor:', 'perf:', 'docs and bookkeeping |']) assert.ok(kinds.includes(`\n| ${k}`), k);
  assert.match(kinds, /\*\*Big\*\* means over about 300 changed lines/);
  for (const row of o.split('\n').filter((l) => /^\| (review-structure|validate) \|/.test(l))) assert.match(row, /Approach by kind/, 'triggers are not restated in the task table');
  assert.match(readFileSync(join(KIT, 'agents', 'implementer.md'), 'utf8'), /approach \(`fix`, `refactor`\)/);
  assert.match(readFileSync(join(KIT, 'agents', 'reviewer.md'), 'utf8'), /brief's approach sets the scope/);
});

test('the must-fix list reaches the board: orchestrate posts FIXES NEEDED, and the stream prompt runs the validator', () => {
  const o = readFileSync(join(KIT, 'skills', 'orchestrate', 'SKILL.md'), 'utf8');
  const loop = readFileSync(join(KIT, 'skills', 'orchestrate', 'review-loop.md'), 'utf8');
  assert.match(o, /`review-loop\.md`/);
  assert.match(loop, /must-fix list[\s\S]{0,700}names, whatever is posted after it[\s\S]{0,300}desk board post verdict <slug> "FIXES NEEDED @<sha>/);
  assert.match(loop, /"MERGE @<sha> overrides: <why>"`, never to skip a fix/);
  assert.match(o, /the must-fix list empty/);
  assert.match(loop, /rebuild the must-fix list[\s\S]{0,120}post `FIXES NEEDED` again/);
  assert.match(readFileSync(join(KIT, 'agents', 'verifier.md'), 'utf8'), /NOT VERIFIED or INCONCLUSIVE there is NOT FIXED/);
  const wt = readFileSync(join(KIT, 'lib', 'wt.mjs'), 'utf8');
  assert.match(wt, /fresh \\`reviewer\\` \+ \\`validator\\`/);
  assert.match(wt, /`Validation:` line/);
});

test('claudeSettings: DESK_HOME plus the desk and worktrees readable, user permissions kept', () => {
  const s = claudeSettings({ home: '/d', worktreesDir: '/w', permissions: { deny: ['Read(x)'], additionalDirectories: ['/extra'] } });
  assert.equal(s.env.DESK_HOME, '/d');
  assert.deepEqual(s.permissions.deny, ['Read(x)']);
  assert.deepEqual(s.permissions.additionalDirectories, ['/d', '/w', '/extra']);
});

test('claudeSettings: outputStyle written when set, absent when empty', () => {
  assert.equal(claudeSettings({ home: '/d', worktreesDir: '/w', outputStyle: 'Explanatory' }).outputStyle, 'Explanatory');
  assert.ok(!('outputStyle' in claudeSettings({ home: '/d', worktreesDir: '/w', outputStyle: '' })));
});

test('ghName reads https and ssh GitHub remotes', () => {
  assert.equal(ghName('https://github.com/o/r.git'), 'o/r');
  assert.equal(ghName('git@github.com:o/r'), 'o/r');
  assert.equal(ghName('/some/bare.git'), '');
});

test('init writes the desk once and keeps what exists', () => {
  const { home } = multiDesk();
  const cfg = JSON.parse(readFileSync(join(home, 'desk.config.json'), 'utf8'));
  assert.deepEqual(cfg.repos.map((r) => [r.id, r.kind, r.path, r.worktreePrefix, r.defaultBranch]),
    [['a', 'git', '../a', 'a-', 'main'], ['b', 'git', '../b', 'b-', 'main'], ['notes', 'folder', '../notes', undefined, undefined]]);
  assert.deepEqual(cfg.harnesses, ['claude', 'copilot']);
  for (const f of ['AGENTS.md', 'CLAUDE.md', 'agent-rules.md', 'todo.jsonl', 'board.jsonl', 'decisions.jsonl', '.gitignore', 'desk.code-workspace', 'package.json', 'desk']) assert.ok(existsSync(join(home, f)), f);
  for (const f of ['NEXT.md', 'TODO.md', 'desk.cmd']) assert.equal(existsSync(join(home, f)), false, f);
  const pkg = JSON.parse(readFileSync(join(home, 'package.json'), 'utf8'));
  assert.equal(pkg.devDependencies['agent-desk'], `github:klintravis/agent-desk#v${JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')).version}`);
  writeFileSync(join(home, 'agent-rules.md'), 'mine\n');
  writeFileSync(join(home, 'package.json'), JSON.stringify({ ...pkg, devDependencies: { 'agent-desk': 'github:klintravis/agent-desk#v9' } }));
  const again = ok(desk(home, 'init', '--no-install'));
  assert.match(again, /kept .*agent-rules\.md/);
  assert.match(again, /kept .*package\.json \(agent-desk github:klintravis\/agent-desk#v9\)/, 'a pinned version is kept');
  assert.equal(readFileSync(join(home, 'agent-rules.md'), 'utf8'), 'mine\n');
  assert.notEqual(desk(tmp(), 'init', '--no-install', '--repo', 'x=missing').status, 0, 'a missing path is refused');
});

test('init --repo naming the desk folder itself writes path "."', () => {
  const home = tmp();
  ok(desk(home, 'init', '--no-install', '--repo', 'me=.'));
  assert.equal(JSON.parse(readFileSync(join(home, 'desk.config.json'), 'utf8')).repos[0].path, '.');
});

test('init hint: both shell forms, the running kit when none is installed, apostrophes doubled', () => {
  const home = join(tmp(), "it's");
  mkdirSync(home);
  const out = ok(desk(home, 'init', '--no-install'));
  const mjs = join(KIT, 'bin', 'desk.mjs');
  assert.ok(out.includes(`PowerShell: \`$env:DESK_HOME = '${home.replace(/'/g, "''")}'; node '${mjs}' sync\``), out);
  assert.ok(out.includes(`cmd: \`set "DESK_HOME=${home}" && node "${mjs}" sync\``), out);
});

test('init writes into the cwd, not the desk DESK_HOME names', () => {
  const other = tmp(), here = tmp();
  ok(desk(other, 'init', '--no-install'));
  const before = readdirSync(other).sort();
  const r = spawnSync(process.execPath, [BIN, 'init', '--no-install'], { cwd: here, env: env(other), encoding: 'utf8' });
  ok(r);
  assert.ok(existsSync(join(here, 'desk.config.json')) && existsSync(join(here, 'AGENTS.md')));
  assert.deepEqual(readdirSync(other).sort(), before, 'the DESK_HOME desk gains no file');
});

test('init skips agent-rules.md when an older desk keeps .claude/agent-rules.md', () => {
  const home = tmp();
  mkdirSync(join(home, '.claude'));
  writeFileSync(join(home, '.claude', 'agent-rules.md'), 'old rules\n');
  ok(desk(home, 'init', '--no-install'));
  assert.ok(!existsSync(join(home, 'agent-rules.md')));
});

test('mergeSettings: the user\'s permissions and hooks survive, our context hook is not doubled', () => {
  const c = { home: '/d', worktreesDir: '/w', permissions: { deny: ['Read(x)'] } };
  const user = { model: 'mine', env: { MINE: '1' }, permissions: { allow: ['Bash(npm test)'], deny: ['Read(y)'], additionalDirectories: ['/u'], defaultMode: 'plan' },
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo mine' }] }], Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }] } };
  const once = mergeSettings(user, claudeSettings(c)), twice = mergeSettings(once, claudeSettings(c));
  assert.deepEqual(twice, once, 'idempotent');
  assert.equal(once.model, 'mine');
  assert.deepEqual(once.env, { MINE: '1', DESK_HOME: '/d' });
  assert.deepEqual(once.permissions.allow, ['Bash(npm test)']);
  assert.deepEqual(once.permissions.deny, ['Read(x)', 'Read(y)']);
  assert.deepEqual(once.permissions.additionalDirectories, ['/d', '/w', '/u']);
  assert.equal(once.permissions.defaultMode, 'plan');
  assert.equal(once.hooks.SessionStart.length, 2);
  assert.equal(once.hooks.SessionStart[0].hooks[0].command, 'echo mine');
  assert.match(once.hooks.SessionStart[1].hooks[0].command, /^node "[^"]+\/scripts\/subagent-context\.mjs" SessionStart "\/d" "\/d"$/, 'shell-neutral node call');
  assert.deepEqual(once.hooks.Stop, user.hooks.Stop);
});

test('mergeSettings: a user hook sharing a group with our old-form hook stays; ours is swapped once', () => {
  const c = { home: '/d', worktreesDir: '/w' };
  const rtk = { type: 'command', command: 'rtk hook' };
  const user = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [rtk, { type: 'command', command: 'node "/old/scripts/subagent-context.mjs" SessionStart' }] }] } };
  const s = mergeSettings(user, claudeSettings(c, '/d/x'));
  assert.deepEqual(s.hooks.SessionStart[0], { matcher: 'startup', hooks: [rtk] });
  assert.equal(s.hooks.SessionStart.length, 2);
  assert.match(s.hooks.SessionStart[1].hooks[0].command, /SessionStart "\/d" "\/d\/x"$/);
  assert.deepEqual(mergeSettings(s, claudeSettings(c, '/d/x')), s, 'idempotent');
});

test('mergeSettings: ask is merged; an entry the desk wrote last time and dropped since is removed', () => {
  const user = { permissions: { allow: ['Bash(mine)', 'Bash(old)'], ask: ['Bash(rm)'], deny: ['Read(gone)'] } };
  const prev = { allow: ['Bash(old)', 'Bash(kept)'], deny: ['Read(gone)'] };
  const s = mergeSettings(user, claudeSettings({ home: '/d', worktreesDir: '/w', permissions: { allow: ['Bash(kept)'], ask: ['Bash(push)'] } }), prev);
  assert.deepEqual(s.permissions.allow, ['Bash(kept)', 'Bash(mine)']);
  assert.deepEqual(s.permissions.ask, ['Bash(push)', 'Bash(rm)']);
  assert.deepEqual(s.permissions.deny, []);
});

test('sync: a permission removed from desk.config.json leaves the checkouts on the next sync', () => {
  const { root, home } = multiDesk();
  const p = join(home, 'desk.config.json'), cfg = JSON.parse(readFileSync(p, 'utf8'));
  writeFileSync(p, JSON.stringify({ ...cfg, permissions: { ...cfg.permissions, allow: ['Bash(gone)'] } }));
  ok(desk(home, 'sync'));
  const f = join(root, 'a', '.claude', 'settings.local.json');
  assert.deepEqual(JSON.parse(readFileSync(f, 'utf8')).permissions.allow, ['Bash(gone)']);
  writeFileSync(p, JSON.stringify(cfg));
  ok(desk(home, 'sync'));
  assert.deepEqual(JSON.parse(readFileSync(f, 'utf8')).permissions.allow, []);
});

test('sync: outputStyle "" removes the style an earlier sync wrote, in the desk and the checkouts', () => {
  const { root, home } = multiDesk();
  ok(desk(home, 'sync'));
  const files = [home, join(root, 'a')].map((d) => join(d, '.claude', 'settings.local.json'));
  for (const f of files) assert.equal(JSON.parse(readFileSync(f, 'utf8')).outputStyle, 'Concise');
  const p = join(home, 'desk.config.json'), cfg = JSON.parse(readFileSync(p, 'utf8'));
  writeFileSync(p, JSON.stringify({ ...cfg, outputStyle: '' }));
  ok(desk(home, 'sync'));
  for (const f of files) assert.ok(!('outputStyle' in JSON.parse(readFileSync(f, 'utf8'))), f);
});

test('sync: the desk\'s own local settings survive when settings.json carries the same names', () => {
  const { home } = multiDesk();
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ env: { FOO: '1' }, enabledPlugins: { 'p@k': true }, model: 'sonnet', outputStyle: 'X' }));
  const p = join(home, 'desk.config.json');
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), outputStyle: '' }));
  const dl = join(home, '.claude', 'settings.local.json');
  writeFileSync(dl, JSON.stringify({ env: { FOO: 'mine' }, enabledPlugins: { 'p@k': false }, model: 'opus', outputStyle: 'Y' }));
  ok(desk(home, 'sync'));
  ok(desk(home, 'sync'));
  const s = JSON.parse(readFileSync(dl, 'utf8'));
  assert.equal(s.env.FOO, 'mine');
  assert.deepEqual(s.enabledPlugins, { 'p@k': false });
  assert.equal(s.model, 'opus');
  assert.equal(s.outputStyle, 'Y');
});

test('sync: the desk\'s settings.json reaches the checkouts, not the desk; dropped entries leave', () => {
  const { root, home } = multiDesk();
  const ds = join(home, '.claude', 'settings.json');
  mkdirSync(join(home, '.claude'), { recursive: true });
  const guard = { matcher: 'Bash', hooks: [{ type: 'command', command: 'node /k/edit-guard.mjs' }] };
  writeFileSync(ds, JSON.stringify({ permissions: { allow: ['Bash'], defaultMode: 'acceptEdits' }, hooks: { PreToolUse: [guard] },
    env: { FOO: '1' }, autoMode: { allow: ['merge ok'] }, promptCacheTtl: '1h', enabledPlugins: { 'agent-desk@agent-desk': true, 'old@k': true } }));
  const f = join(root, 'a', '.claude', 'settings.local.json');
  mkdirSync(join(root, 'a', '.claude'), { recursive: true });
  writeFileSync(f, JSON.stringify({ enabledPlugins: { 'mine@x': true }, hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'fmt' }] }] } }));
  const dl = join(home, '.claude', 'settings.local.json');
  writeFileSync(dl, JSON.stringify({ enabledPlugins: { 'mine@x': true }, model: 'opus' }));
  ok(desk(home, 'sync'));
  const once = readFileSync(f, 'utf8'), s = JSON.parse(once);
  assert.deepEqual(s.permissions.allow, ['Bash']);
  assert.deepEqual(s.autoMode, { allow: ['merge ok'] });
  assert.equal(s.promptCacheTtl, '1h');
  assert.deepEqual(s.enabledPlugins, { 'mine@x': true, 'agent-desk@agent-desk': true, 'old@k': true });
  assert.equal(s.env.FOO, '1');
  assert.equal(s.permissions.defaultMode, 'acceptEdits');
  assert.deepEqual(s.hooks.PreToolUse.map((g) => g.hooks[0].command), ['fmt', 'node /k/edit-guard.mjs']);
  assert.equal(s.hooks.SessionStart.length, 1);
  ok(desk(home, 'sync'));
  assert.equal(readFileSync(f, 'utf8'), once, 'idempotent');
  ok(desk(home, 'sync', home), 'the desk named as a target is still the desk');
  const own = JSON.parse(readFileSync(dl, 'utf8'));
  assert.ok(!own.autoMode && !own.hooks.PreToolUse && !own.env.FOO, 'the desk reads its own settings.json');
  assert.deepEqual([own.enabledPlugins, own.model], [{ 'mine@x': true }, 'opus'], 'the desk keeps the user\'s keys');
  // A typo in settings.json must not strip the guards: sync fails and leaves the checkout alone.
  writeFileSync(ds, '{ // typo\n}');
  assert.equal(desk(home, 'sync').status, 1);
  assert.equal(readFileSync(f, 'utf8'), once);
  writeFileSync(ds, JSON.stringify({ permissions: {}, enabledPlugins: { 'agent-desk@agent-desk': true } }));
  ok(desk(home, 'sync'));
  writeFileSync(ds, JSON.stringify({ permissions: {} }));
  ok(desk(home, 'sync'));
  const t = JSON.parse(readFileSync(f, 'utf8'));
  assert.deepEqual(t.permissions.allow, []);
  assert.ok(!('autoMode' in t) && !('promptCacheTtl' in t) && !('FOO' in t.env) && !('defaultMode' in t.permissions));
  assert.deepEqual(t.enabledPlugins, { 'mine@x': true }, 'dropped plugins go, the user\'s stays');
  assert.deepEqual(t.hooks.PreToolUse.map((g) => g.hooks[0].command), ['fmt']);
  assert.deepEqual(JSON.parse(readFileSync(dl, 'utf8')).enabledPlugins, { 'mine@x': true });
});

test('sync leaves a settings or workspace file it cannot parse untouched and exits 1', () => {
  const { root, home } = multiDesk();
  const f = join(root, 'b', '.claude', 'settings.local.json'), jsonc = '{\n  // mine\n  "model": "x"\n}\n';
  mkdirSync(join(root, 'b', '.claude'), { recursive: true });
  writeFileSync(f, jsonc);
  const ws = join(home, 'desk.code-workspace'), wsText = '{ "folders": [], // c\n "settings": { "a": 1 } }';
  writeFileSync(ws, wsText);
  const r = desk(home, 'sync');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not plain JSON/);
  assert.equal(readFileSync(f, 'utf8'), jsonc);
  assert.equal(readFileSync(ws, 'utf8'), wsText);
  assert.ok(existsSync(join(root, 'a', '.claude', 'settings.local.json')), 'the other checkouts still sync');
  writeFileSync(f, '{}');
  assert.equal(desk(home, 'sync').status, 1, 'a broken workspace file alone fails the sync');
  assert.equal(readFileSync(ws, 'utf8'), wsText);
});

test('sync hides the plumbing in the desk\'s .vscode/settings.json, keeping the user\'s keys', () => {
  const { home } = multiDesk();
  const f = join(home, '.vscode', 'settings.json');
  ok(desk(home, 'sync'));
  const ex = JSON.parse(readFileSync(f, 'utf8'))['files.exclude'];
  assert.equal(Object.keys(ex).length, 9);
  assert.ok(Object.values(ex).every((v) => v === true));
  writeFileSync(f, JSON.stringify({ 'editor.tabSize': 2, 'files.exclude': { 'package.json': false, '*.tmp': true } }));
  ok(desk(home, 'sync'));
  const s = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(s['editor.tabSize'], 2);
  assert.equal(s['files.exclude']['package.json'], false);
  assert.equal(s['files.exclude']['*.tmp'], true);
  assert.equal(s['files.exclude']['.claude'], true);
  const before = readFileSync(f, 'utf8');
  ok(desk(home, 'sync'));
  assert.equal(readFileSync(f, 'utf8'), before, 'second run changes nothing');
  assert.deepEqual(JSON.parse(readFileSync(join(home, 'desk.code-workspace'), 'utf8')).settings ?? {}, {}, 'not in the workspace file');
  const bad = '{ // mine\n}';
  writeFileSync(f, bad);
  assert.equal(desk(home, 'sync').status, 0, 'a JSONC settings.json is left alone without failing');
  assert.equal(readFileSync(f, 'utf8'), bad);
  rmSync(f);
  rmSync(join(home, 'desk.code-workspace'));
  ok(desk(home, 'sync'));
  assert.equal(JSON.parse(readFileSync(f, 'utf8'))['files.exclude']['.claude'], true, 'sync without a workspace file still hides');
  rmSync(f);
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'agent-rules.md'), 'x');
  ok(desk(home, 'sync'));
  assert.ok(!('.claude' in JSON.parse(readFileSync(f, 'utf8'))['files.exclude']), 'older desk keeps .claude visible');
});

test('sync: a desk nested in another repo leaves that repo\'s info/exclude alone', () => {
  const outer = tmp();
  git(outer, 'init', '-q');
  const home = join(outer, 'desk');
  mkdirSync(home);
  ok(desk(home, 'init', '--no-install'));
  ok(desk(home, 'sync'));
  assert.ok(existsSync(join(home, '.claude', 'settings.local.json')));
  const ex = join(outer, '.git', 'info', 'exclude');
  assert.ok(!existsSync(ex) || !readFileSync(ex, 'utf8').includes('settings.local.json'));
});

test('sync: Claude settings per checkout, Copilot files in the desk only, workspace refreshed', () => {
  const { root, home } = multiDesk();
  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a'));
  const out = ok(desk(home, 'sync'));
  for (const d of [home, join(root, 'a'), join(root, 'b'), join(root, 'worktrees', 'a-demo')]) {
    const s = JSON.parse(readFileSync(join(d, '.claude', 'settings.local.json'), 'utf8'));
    assert.equal(s.env.DESK_HOME, home, d);
    assert.equal(s.outputStyle, 'Concise', 'the default style');
    assert.ok(s.permissions.additionalDirectories.includes(join(root, 'notes').replace(/\\/g, '/')), 'plain folder readable');
  }
  assert.ok(!existsSync(join(root, 'notes', '.claude')), 'a plain folder gets no settings file');
  assert.equal(git(join(root, 'a'), 'status', '--porcelain'), '', 'settings ignored via info/exclude');
  const strayTmp = join(root, 'a', '.claude', 'settings.local.json.1.tmp');
  writeFileSync(strayTmp, '{}\n');
  assert.equal(git(join(root, 'a'), 'status', '--porcelain'), '', 'a leftover temp file is ignored too');
  rmSync(strayTmp);
  for (const s of readdirSync(join(KIT, 'skills'))) assert.ok(existsSync(join(home, '.github', 'skills', s, 'SKILL.md')), s);
  for (const a of ['archiver', 'ci-triage', 'implementer', 'reviewer', 'scribe', 'structure-reviewer', 'validator', 'verifier']) assert.ok(existsSync(join(home, '.github', 'agents', `${a}.agent.md`)), a);
  const scribe = parseFrontmatter(readFileSync(join(KIT, 'agents', 'scribe.md'), 'utf8')).meta;
  assert.deepEqual([scribe.model, scribe.effort], ['haiku', 'low']);
  const scribeCopilot = readFileSync(join(home, '.github', 'agents', 'scribe.agent.md'), 'utf8');
  assert.match(scribeCopilot, /reasoning-effort: "low"/);
  assert.doesNotMatch(scribeCopilot, /^model:/m);
  assert.match(scribeCopilot, /^tools: \["read", "search", "edit", "execute"\]$/m);
  assert.equal(parseFrontmatter(readFileSync(join(KIT, 'agents', 'archiver.md'), 'utf8')).meta.model, 'sonnet');
  assert.match(readFileSync(join(KIT, 'skills', 'orchestrate', 'SKILL.md'), 'utf8'), /\| `scribe` \| haiku \| low \|/);
  assert.ok(!existsSync(join(home, '.github', 'hooks')), 'no second hook source: Copilot reads the settings hooks');
  const sl = (p) => p.replace(/\\/g, '/'), kitCtx = sl(join(KIT, 'scripts', 'subagent-context.mjs'));
  for (const d of [home, join(root, 'worktrees', 'a-demo')]) {
    assert.equal(JSON.parse(readFileSync(join(d, '.claude', 'settings.local.json'), 'utf8')).hooks.SubagentStart[0].hooks[0].command,
      `node "${kitCtx}" SubagentStart "${sl(home)}" "${sl(d)}"`, 'the running kit (none pinned), the desk and this checkout');
  }
  // the shim runs the desk command from any folder, DESK_HOME unset
  const { status, stdout } = spawnSync('sh', [join(home, 'desk'), 'home'], { cwd: tmp(), env: { ...process.env, DESK_HOME: '' }, encoding: 'utf8' });
  assert.equal(status, 0);
  assert.equal(stdout.trim(), home);
  assert.ok(!existsSync(join(root, 'a', '.github')), 'repos get no Copilot files');
  assert.match(out, /copilot /);

  // the user's own settings keys survive a re-sync
  const f = join(root, 'b', '.claude', 'settings.local.json');
  writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, 'utf8')), model: 'mine' }));
  ok(desk(home, 'sync'));
  assert.equal(JSON.parse(readFileSync(f, 'utf8')).model, 'mine');

  const ws = JSON.parse(readFileSync(join(home, 'desk.code-workspace'), 'utf8'));
  assert.deepEqual(ws.folders.map((x) => x.name), ['desk', 'a', 'b', 'notes', 'wt demo (a)']);
});

test('sync with harnesses [claude] writes no Copilot files', () => {
  const { home } = multiDesk();
  const p = join(home, 'desk.config.json');
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), harnesses: ['claude'] }));
  ok(desk(home, 'sync'));
  assert.ok(!existsSync(join(home, '.github')));
});

test('sync uses the desk\'s pinned kit and records its version; an old Copilot hooks file is removed', () => {
  const { home } = multiDesk();
  ok(desk(home, 'sync')); // first on the running kit, before the pinned one is installed
  const pinned = join(home, 'node_modules', 'agent-desk');
  mkdirSync(join(pinned, 'scripts'), { recursive: true });
  for (const d of ['skills', 'agents']) cpSync(join(KIT, d), join(pinned, d), { recursive: true });
  writeFileSync(join(pinned, 'package.json'), JSON.stringify({ name: 'agent-desk', version: '9.9.9' }));
  mkdirSync(join(home, '.github', 'hooks'), { recursive: true });
  writeFileSync(join(home, '.github', 'hooks', 'agent-desk.json'), '{}');
  assert.match(ok(desk(home, 'sync')), new RegExp(`kitVersion ${KIT_VERSION.replace(/\./g, '\\.')} -> 9\\.9\\.9`));
  const s = JSON.parse(readFileSync(join(home, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual([s.hooks.SessionStart.length, s.hooks.SubagentStart.length], [1, 1], 'the kit path changed: the old hook is replaced, not kept');
  assert.equal(s.hooks.SessionStart[0].hooks[0].command, `node "${join(pinned, 'scripts', 'subagent-context.mjs').replace(/\\/g, '/')}" SessionStart "${home.replace(/\\/g, '/')}" "${home.replace(/\\/g, '/')}"`);
  assert.equal(JSON.parse(readFileSync(join(home, 'desk.config.json'), 'utf8')).kitVersion, '9.9.9');
  assert.ok(!existsSync(join(home, '.github', 'hooks', 'agent-desk.json')));
});

test('sync: kitVersion stays put after a failed sync and after a partial `desk sync <checkout>`', () => {
  const { root, home } = multiDesk();
  const pinned = join(home, 'node_modules', 'agent-desk');
  mkdirSync(join(pinned, 'scripts'), { recursive: true });
  for (const d of ['skills', 'agents']) cpSync(join(KIT, d), join(pinned, d), { recursive: true });
  writeFileSync(join(pinned, 'package.json'), JSON.stringify({ name: 'agent-desk', version: '9.9.9' }));
  const version = () => JSON.parse(readFileSync(join(home, 'desk.config.json'), 'utf8')).kitVersion;
  const f = join(root, 'b', '.claude', 'settings.local.json');
  mkdirSync(join(root, 'b', '.claude'), { recursive: true });
  writeFileSync(f, '{ // broken\n}');
  assert.equal(desk(home, 'sync').status, 1);
  assert.equal(version(), KIT_VERSION, 'failed sync');
  writeFileSync(f, '{}');
  ok(desk(home, 'sync', join(root, 'a')));
  assert.equal(version(), KIT_VERSION, 'partial sync');
  ok(desk(home, 'sync'));
  assert.equal(version(), '9.9.9');
});

test('sync: a desk.cmd with the marker is deleted and none is written', () => {
  const { home } = multiDesk();
  assert.ok(!existsSync(join(home, 'desk.cmd')), 'init wrote none');
  writeFileSync(join(home, 'desk.cmd'), '@echo off\r\nrem written by desk sync\r\n');
  ok(desk(home, 'sync'));
  assert.ok(!existsSync(join(home, 'desk.cmd')));
  assert.ok(existsSync(join(home, 'desk')));
  assert.ok(!readFileSync(join(home, '.gitignore'), 'utf8').includes('desk.cmd'));
});

test('sync: a desk.cmd without the shim marker, or a desk without it or a desk/ folder, is left alone (a foreign desk.cmd only warns, a foreign desk exits 1)', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'desk.cmd'), 'mine\r\n');
  let r = desk(home, 'sync');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /desk\.cmd exists and is not the desk shim/);
  assert.equal(readFileSync(join(home, 'desk.cmd'), 'utf8'), 'mine\r\n');
  assert.match(readFileSync(join(home, 'desk'), 'utf8'), /written by desk sync/, 'our own shim is still rewritten');
  rmSync(join(home, 'desk'));
  mkdirSync(join(home, 'desk'));
  r = desk(home, 'sync');
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /[\\/]desk exists and is not the desk shim/);
  assert.ok(existsSync(join(home, '.github', 'agents')), 'the rest of the sync ran');
});

test('mergeSettings: a null or string record of synced permissions removes nothing', () => {
  const user = { permissions: { allow: ['Bash(mine)'], deny: ['Read(x)'] } };
  const s = mergeSettings(user, claudeSettings({ home: '/d', worktreesDir: '/w' }), { allow: null, deny: 'Read(x)' });
  assert.deepEqual([s.permissions.allow, s.permissions.deny], [['Bash(mine)'], ['Read(x)']]);
  assert.deepEqual(mergeSettings(user, claudeSettings({ home: '/d', worktreesDir: '/w' }), null).permissions.allow, ['Bash(mine)']);
});

const shippedKit = () => {
  const kit = join(tmp(), 'agent-desk');
  for (const d of [...JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')).files, 'package.json']) {
    if (existsSync(join(KIT, d))) cpSync(join(KIT, d), join(kit, d), { recursive: true });
  }
  return kit;
};

test('desk check on a kit without test/ (the npm-installed copy) skips the kit tests and exits 0', () => {
  const r = spawnSync(process.execPath, [join(shippedKit(), 'bin', 'desk.mjs'), 'check'], { cwd: tmp(), env: { ...process.env, DESK_HOME: '' }, encoding: 'utf8', timeout: 400e3 });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /skip kit tests: not shipped/);
});

test('desk check warns about the user layer and keeps its exit code', () => {
  const { home } = multiDesk(), kit = shippedKit();
  // Only node on PATH: the plugin checks skip, so this stays quick.
  const check = (file) => spawnSync(process.execPath, [join(kit, 'bin', 'desk.mjs'), 'check'], { cwd: home, env: { ...env(home), AGENT_DESK_SETTINGS: file, PATH: dirname(process.execPath), Path: dirname(process.execPath) }, encoding: 'utf8', timeout: 400e3 });
  const active = userFile({ tasks: { review: { effort: 'medium' } } }), active_ = check(active);
  assert.equal(active_.status, 0, `${active_.stdout}\n${active_.stderr}`);
  assert.ok(active_.stdout.split('\n').some((l) => l.startsWith('warn user settings active') && l.includes(active)), active_.stdout);
  const bad = check(userFile('{nope'));
  assert.equal(bad.status, 0, `${bad.stdout}\n${bad.stderr}`);
  assert.match(bad.stdout, /^warn .*not valid JSON/m);
  assert.doesNotMatch(bad.stdout, /user settings active/);
});

// ---- merge "review": the deny on desk.config.json ----
test('claudeSettings: the deny under review, in the form the permission docs give for an absolute path', () => {
  const deny = (home, repos, permissions) => claudeSettings({ home, worktreesDir: '/w', repos, permissions }).permissions.deny;
  const review = [{ id: 'a' }, { id: 'b', merge: 'review' }];
  assert.deepEqual(deny('C:\\Desk\\d', review), ['Edit(//c/Desk/d/desk.config.json)']);
  assert.deepEqual(deny('/home/me/d', review), ['Edit(//home/me/d/desk.config.json)']);
  assert.deepEqual(deny('/d', review, { deny: ['Bash(rm:*)'] }), ['Bash(rm:*)', 'Edit(//d/desk.config.json)']);
  const direct = { home: '/d', worktreesDir: '/w', repos: [{ id: 'a' }, { id: 'b', merge: 'direct' }] };
  assert.deepEqual(claudeSettings(direct), claudeSettings({ ...direct, repos: [{ id: 'a' }] }), 'direct writes what a desk without the key writes');
  assert.equal(claudeSettings(direct).permissions.deny, undefined);
});

test('desk sync: the deny and one line per review repo come and go; the user keeps their own rule', () => {
  const { home } = multiDesk();
  const merge = (value) => setRepo(home, 'a', { merge: value });
  const LINE = /^merge {3}a: review; edits to desk\.config\.json denied for Claude; protect main on the server$/m;
  const local = join(home, '.claude', 'settings.local.json');
  const denied = () => JSON.parse(readFileSync(local, 'utf8')).permissions.deny ?? [];
  const before = ok(desk(home, 'sync'));
  assert.doesNotMatch(before, /^merge /m);
  assert.deepEqual(denied(), []);
  const user = JSON.parse(readFileSync(local, 'utf8'));
  writeFileSync(local, JSON.stringify({ ...user, permissions: { ...user.permissions, deny: ['Read(./secret)'] } }));
  merge('review');
  assert.match(ok(desk(home, 'sync')), LINE);
  const rule = denied().find((r) => r.startsWith('Edit('));
  assert.match(rule, /^Edit\(\/\/.*\/desk\.config\.json\)$/);
  assert.ok(denied().includes('Read(./secret)'));
  merge('direct');
  assert.doesNotMatch(ok(desk(home, 'sync')), /^merge /m);
  assert.deepEqual(denied(), ['Read(./secret)']);
});

test('desk check: direct prints nothing new and asks gh nothing; review warns and keeps the exit code', () => {
  const { home } = multiDesk(), kit = shippedKit(), answers = join(tmp(), 'gh.json');
  writeFileSync(answers, '{}');
  const stub = pathToFileURL(join(KIT, 'test', 'gh-stub.mjs')).href;
  const set = (fields) => setRepo(home, 'a', fields);
  // Only node on PATH: the plugin checks skip, so this stays quick.
  const check = () => spawnSync(process.execPath, [join(kit, 'bin', 'desk.mjs'), 'check'], { cwd: home, encoding: 'utf8', timeout: 400e3,
    env: { ...env(home), GH_STUB: answers, NODE_OPTIONS: `--import=${stub}`, PATH: dirname(process.execPath), Path: dirname(process.execPath) } });
  set({ gh: 'o/r' });
  const direct = check();
  assert.equal(direct.status, 0, `${direct.stdout}\n${direct.stderr}`);
  assert.doesNotMatch(direct.stdout, /protect|merge changed|has merge/);
  assert.equal(existsSync(`${answers}.log`), false, 'no gh call');
  set({ gh: '', merge: 'review' });
  const review = check();
  assert.equal(review.status, 0, `${review.stdout}\n${review.stderr}`);
  assert.match(review.stdout, /^warn a has merge "review" and no gh value: wt merge will refuse on this repo; only a server rule is a guarantee$/m);
});

// ---- the user layer: its file is always a temp one, outside every git tree ----
const userFile = (v) => { const f = join(tmp(), 'settings.json'); writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v)); return f; };
const withUser = (home, file, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: home, env: { ...env(home), AGENT_DESK_SETTINGS: file }, encoding: 'utf8' });
const localSettings = (dir) => JSON.parse(readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf8'));
const treeOf = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => { const p = join(e.parentPath ?? e.path, e.name); return [p, readFileSync(p, 'utf8')]; }));
const bothHarnesses = (home) => { const p = join(home, 'desk.config.json'); writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), harnesses: ['claude', 'copilot'] })); };
const deskCarries = (home, keys) => { const p = join(home, '.claude', 'settings.json'); mkdirSync(join(home, '.claude'), { recursive: true }); writeFileSync(p, JSON.stringify({ ...(existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}), ...keys })); return p; };

test('never committed: a user file changes nothing git can see in the desk, a repo or a worktree', () => {
  const { root, home } = multiDesk(), repoA = join(root, 'a'), wt = join(root, 'worktrees', 'a-demo');
  bothHarnesses(home);
  ok(desk(home, 'wt', 'new', 'demo', '--repo', 'a'));
  const dir = readdirSync(join(root, 'worktrees')).map((d) => join(root, 'worktrees', d)).find((d) => d.endsWith('demo')) ?? wt;
  ok(desk(home, 'sync'));
  git(home, 'init', '-q'); git(home, 'add', '-A'); git(home, '-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'desk');
  for (const d of [home, repoA, dir]) assert.equal(git(d, 'status', '--porcelain'), '', d);
  const f = userFile({ tasks: { review: { model: 'fable', effort: 'max' }, 'ci-summary': { model: 'opus' } }, cache: { promptCacheTtl: '5m', subagentPromptCacheTtl: '1h', idleCompaction: true } });
  // Never gitignored to pass: a broad rule could hide a real leak.
  for (const d of [home, repoA, dir]) assert.ok(!f.startsWith(d), `${f} sits in ${d}`);
  const copilot = treeOf(join(home, '.github'));
  ok(withUser(home, f, 'sync'));
  for (const d of [home, repoA, dir]) {
    assert.equal(git(d, 'status', '--porcelain'), '', d);
    const l = localSettings(d);
    assert.deepEqual([l.promptCacheTtl, l.subagentPromptCacheTtl, l.idleCompaction], ['5m', '1h', true], d);
    assert.equal(l.tasks, undefined);
  }
  assert.deepEqual(treeOf(join(home, '.github')), copilot); // task values reach no Copilot file
  const rec = readFileSync(join(home, '.claude', 'synced-permissions.json'), 'utf8');
  for (const name of ['promptCacheTtl', 'subagentPromptCacheTtl', 'idleCompaction']) assert.match(rec, new RegExp(name));
  assert.doesNotMatch(rec, /"5m"|"1h"|"fable"|"max"/); // names only
});

test('user cache keys beat the desk\'s, keep hand-added keys, and go when removed', () => {
  const { root, home } = multiDesk(), repoA = join(root, 'a');
  const shared = deskCarries(home, { promptCacheTtl: '1h' }), sharedBefore = readFileSync(shared, 'utf8');
  ok(desk(home, 'sync'));
  assert.equal(localSettings(repoA).promptCacheTtl, '1h');
  assert.equal(localSettings(home).promptCacheTtl, undefined); // the desk's own settings.json applies there
  const handFile = join(repoA, '.claude', 'settings.local.json');
  writeFileSync(handFile, JSON.stringify({ ...localSettings(repoA), mine: 1 }));
  ok(withUser(home, userFile({ cache: { promptCacheTtl: '5m', idleCompaction: false } }), 'sync'));
  for (const d of [home, repoA]) assert.deepEqual([localSettings(d).promptCacheTtl, localSettings(d).idleCompaction], ['5m', false], d);
  assert.equal(localSettings(repoA).mine, 1);
  assert.equal(readFileSync(shared, 'utf8'), sharedBefore);
  ok(desk(home, 'sync')); // no user file now
  assert.equal(localSettings(repoA).promptCacheTtl, '1h');
  assert.equal(localSettings(repoA).idleCompaction, undefined);
  assert.equal(localSettings(repoA).mine, 1);
  assert.equal(localSettings(home).promptCacheTtl, undefined);
  assert.equal(localSettings(home).idleCompaction, undefined);
});

test('a partial sync writes the user\'s cache keys and leaves the record alone', () => {
  const { root, home } = multiDesk(), repoA = join(root, 'a'), rec = join(home, '.claude', 'synced-permissions.json');
  ok(desk(home, 'sync'));
  const before = readFileSync(rec, 'utf8');
  ok(withUser(home, userFile({ cache: { promptCacheTtl: '5m' } }), 'sync', repoA));
  assert.equal(localSettings(repoA).promptCacheTtl, '5m');
  assert.equal(readFileSync(rec, 'utf8'), before);
});

test('wt new writes the user\'s cache keys into the new worktree', () => {
  const { root, home } = multiDesk();
  ok(withUser(home, userFile({ cache: { promptCacheTtl: '5m' } }), 'wt', 'new', 'demo', '--repo', 'a'));
  const dir = readdirSync(join(root, 'worktrees')).map((d) => join(root, 'worktrees', d)).find((d) => d.endsWith('demo'));
  assert.equal(localSettings(dir).promptCacheTtl, '5m');
});

// The checkout's synced settings.local.json, plus idleCompaction (which the desk does not carry), committed.
const commitLocalSettings = (dir) => {
  writeFileSync(join(dir, '.claude', 'settings.local.json'), JSON.stringify({ ...localSettings(dir), idleCompaction: true }, null, 2) + '\n');
  git(dir, 'add', '-f', '.claude/settings.local.json'); git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'tracked');
  return join(dir, '.claude', 'settings.local.json');
};

for (const [why, after] of [['the key leaves the user file', { cache: { promptCacheTtl: '5m' } }], ['the user cache is emptied', { cache: {} }]]) {
  test(`a tracked key survives a full sync after ${why}; an ignored file still loses it`, () => {
    const { root, home } = multiDesk(), repoA = join(root, 'a'), repoB = join(root, 'b');
    ok(desk(home, 'sync'));
    commitLocalSettings(repoA);
    ok(withUser(home, userFile({ cache: { idleCompaction: false } }), 'sync')); // the record now lists the name
    assert.equal(localSettings(repoB).idleCompaction, false);
    ok(withUser(home, userFile(after), 'sync'));
    assert.equal(localSettings(repoA).idleCompaction, true);
    assert.equal(git(repoA, 'status', '--porcelain').trim(), '');
    assert.equal(localSettings(repoB).idleCompaction, undefined);
  });
}

test('a tracked key in the desk folder survives the user removing it', () => {
  const { root, home } = multiDesk();
  git(home, 'init', '-q');
  ok(desk(home, 'sync'));
  commitLocalSettings(home);
  ok(withUser(home, userFile({ cache: { idleCompaction: false } }), 'sync'));
  ok(withUser(home, userFile({ cache: {} }), 'sync'));
  assert.equal(localSettings(home).idleCompaction, true);
  assert.equal(git(home, 'status', '--porcelain', '--', '.claude/settings.local.json').trim(), '');
  assert.equal(localSettings(join(root, 'a')).idleCompaction, undefined);
});

// A tracked desk-folder settings.local.json, a user file with cache keys, then `desk sync` with the given harnesses.
const trackedWarning = (harnesses) => {
  const { home } = multiDesk(), p = join(home, 'desk.config.json');
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), harnesses }));
  git(home, 'init', '-q');
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.local.json'), '{}\n');
  git(home, 'add', '-f', '.claude/settings.local.json');
  const r = withUser(home, userFile({ cache: { promptCacheTtl: '5m' } }), 'sync');
  assert.equal(r.status, 0, r.stderr);
  if (!harnesses.includes('claude')) {
    const s = withUser(home, userFile({ cache: { promptCacheTtl: '5m' } }), 'settings', '--json');
    assert.deepEqual(JSON.parse(s.stdout).warnings.filter((w) => /not ignored by git/.test(w)), []);
  }
  return r.stderr.split('\n').filter((l) => /^warn .*not ignored by git/.test(l));
};

test('desk sync warns once on stderr about a tracked settings file when the claude harness is on', () => {
  assert.equal(trackedWarning(['claude']).length, 1);
});

test('desk sync does not warn about a tracked settings file on a Copilot-only desk (the cache keys are Claude Code\'s)', () => {
  assert.deepEqual(trackedWarning(['copilot']), []);
});

test('a key both layers set follows the desk in a tracked file', () => {
  const { root, home } = multiDesk(), repoA = join(root, 'a');
  const shared = deskCarries(home, { promptCacheTtl: '1h' });
  ok(desk(home, 'sync'));
  commitLocalSettings(repoA);
  ok(withUser(home, userFile({ cache: { promptCacheTtl: '5m' } }), 'sync'));
  ok(withUser(home, userFile({ cache: {} }), 'sync'));
  assert.equal(localSettings(repoA).promptCacheTtl, '1h');
  assert.equal(git(repoA, 'status', '--porcelain').trim(), '');
  writeFileSync(shared, '{}'); // the desk wrote this one, so its removal still reaches the file
  ok(desk(home, 'sync'));
  assert.equal(localSettings(repoA).promptCacheTtl, undefined);
});

test('a tracked settings.local.json gets no user value and a warning; the rest of the sync proceeds', () => {
  const { root, home } = multiDesk(), repoA = join(root, 'a'), repoB = join(root, 'b');
  ok(desk(home, 'sync'));
  const tracked = commitLocalSettings(repoA); // the desk does not carry idleCompaction
  const user = userFile({ cache: { promptCacheTtl: '5m', idleCompaction: false } });
  const r = withUser(home, user, 'sync');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stderr.split('\n').some((l) => l.startsWith('warn ') && l.includes(tracked)), r.stderr);
  assert.equal(localSettings(repoA).promptCacheTtl, undefined);
  assert.equal(localSettings(repoB).promptCacheTtl, '5m');
  // a second full sync must not drop the committed key as stale
  assert.equal(withUser(home, user, 'sync').status, 0);
  assert.equal(localSettings(repoA).idleCompaction, true);
  assert.equal(git(repoA, 'status', '--porcelain').trim(), '');
});

test('a malformed user file warns, writes the carried keys and exits as without it', () => {
  const { root, home } = multiDesk();
  deskCarries(home, { promptCacheTtl: '1h' });
  const r = withUser(home, userFile('{"promptCacheTtl": "5m"'), 'sync');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /^warn .*not valid JSON/m);
  assert.equal(localSettings(join(root, 'a')).promptCacheTtl, '1h');
});

test('Copilot output is byte for byte the same with and without a user file; a Copilot-only desk gets no cache keys', () => {
  const { home } = multiDesk();
  const p = join(home, 'desk.config.json');
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), harnesses: ['copilot'] }));
  ok(desk(home, 'sync'));
  const without = treeOf(join(home, '.github'));
  ok(withUser(home, userFile({ tasks: { review: { model: 'fable' } }, cache: { promptCacheTtl: '5m' } }), 'sync'));
  assert.deepEqual(treeOf(join(home, '.github')), without);
  assert.equal(localSettings(home).promptCacheTtl, undefined);
  const s = withUser(home, userFile({ cache: { promptCacheTtl: '5m' } }), 'settings');
  assert.doesNotMatch(s.stderr, /not applied yet/); // sync never writes it here: nothing to wait for
});

// The two NEXT.md shapes desks hold, in neutral wording.
const NEXT_A = `# Desk state

Shared state for the desk; rulings are not verified live.

## Work

- T-3: something in flight.

## Waiting on the owner

## Rulings recorded
- tooling (owner, 2026-10-31, other desk T-51): the desk becomes its own kit
  with a CLI; making it public waits on the owner (T-10).
- Owner, 2026-11-01 (T-40): drop NEXT.md: rulings go to decisions.jsonl.

## Not yet verified live
- Plugin prune: on compaction it cuts re-readable tool output
  and keeps the conversation (T-26).
- Plugin warm-hold: pings the cache at 50 min idle (T-27).
`;
const NEXT_B = `# Desk state

Shared state; read it live.

main = abc1234, develop = def5678.

## Work

Free text about the work in flight.

## Waiting on the owner

## Rulings recorded
- Owner, 2026-11-01: this desk owns only the server; the kit lives
  elsewhere (T-53 below).
- Release gate (owner, 2026-10-30): tag only after CI is green.
- Every change goes through a worktree.
- Server config: decided on 2026-10-29 to keep one file.

## Not yet verified live
The build on the test host after the last merge; check the job log
and the deployed version.

The nightly job.

## Efficiency notes
- An agent hit 300k context reading logs.
`.replace(/\n/g, '\r\n');
const GENERATED_TODO = '# Desk todos\n\nGenerated from `todo.jsonl` by `desk todo md`; edit todos with `desk todo`, not this file.\n';
const lines = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const watchTodos = (home) => lines(join(home, 'todo.jsonl')).filter((l) => l.set.area === 'watch');

test('sync migrates NEXT.md (bullets, LF) once; a generated TODO.md goes', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'NEXT.md'), NEXT_A);
  writeFileSync(join(home, 'TODO.md'), GENERATED_TODO);
  const out = ok(desk(home, 'sync'));
  assert.match(out, /migrated NEXT\.md: 2 rulings, 2 watch todos \(NEXT\.md\.bak keeps: Work\)/);
  assert.match(out, /removed TODO\.md/);
  const d = lines(join(home, 'decisions.jsonl'));
  assert.deepEqual(d.map(({ date, todo, source, v }) => [date, todo, source, v]), [['2026-10-31', undefined, 'NEXT.md', 1], ['2026-11-01', 'T-40', 'NEXT.md', 1]]);
  assert.equal(d[0].text, 'tooling (owner, 2026-10-31, other desk T-51): the desk becomes its own kit with a CLI; making it public waits on the owner (T-10).');
  const w = watchTodos(home);
  assert.deepEqual(w.map((l) => [l.id, l.set.status]), [['T-1', 'open'], ['T-2', 'open']]);
  assert.equal(w[0].set.why, 'Plugin prune: on compaction it cuts re-readable tool output and keeps the conversation (T-26).');
  assert.equal(readFileSync(join(home, 'NEXT.md.bak'), 'utf8'), NEXT_A);
  assert.ok(!existsSync(join(home, 'NEXT.md')) && !existsSync(join(home, 'TODO.md')));
  const again = ok(desk(home, 'sync'));
  assert.doesNotMatch(again, /migrated|TODO\.md/, 'second run: nothing to do');
  assert.equal(lines(join(home, 'decisions.jsonl')).length, 2);
  assert.equal(watchTodos(home).length, 2);
});

test('sync migrates a watch item naming an open todo by moving it; done, missing, owner and several ids add one', () => {
  const { home } = multiDesk();
  const ts = '2026-11-01T00:00:00.000Z', tf = join(home, 'todo.jsonl');
  const rows = [['T-1', 'open', 'desk'], ['T-2', 'done', 'desk'], ['T-3', 'active', 'desk'], ['T-4', 'open', 'desk'], ['T-5', 'open', 'owner'],
    ['T-6', 'blocked', 'desk'], ['T-7', 'dropped', 'desk'], ['T-8', 'open', 'idea'], ['T-9', 'active', 'plugin']];
  writeFileSync(tf, rows.map(([id, status, area]) => JSON.stringify({ ts, from: 'aaaa', id, set: { title: `todo ${id}`, status, area, size: 'small' } })).join('\n') + '\n');
  writeFileSync(join(home, 'NEXT.md'), `# State

## Not yet verified live
- Prune on compaction (T-1).
- Old thing (T-2).
- Ghost (T-99).
- Both (T-3) and (T-4).
- Owner call (T-5).
- Second look (T-1).
- Running (T-9).
- Stuck (T-6).
- Dropped one (T-7).
- Idea (T-8).
`);
  const out = ok(desk(home, 'sync'));
  assert.match(out, /migrated NEXT\.md: 0 rulings, 10 watch todos/);
  assert.equal(out.match(/^moved T-\d+ to watch; .*$/gm).length, 3, 'one line per moved todo');
  assert.match(out, /^moved T-1 to watch; if the item only cites it: desk todo set T-1 --area desk$/m);
  assert.match(out, /^moved T-9 to watch; if the item only cites it: desk todo set T-9 --area plugin$/m);
  const t = fold(lines(tf));
  assert.deepEqual(['T-1', 'T-6', 'T-9'].map((id) => t.get(id).area), ['watch', 'watch', 'watch'], 'open, blocked and active todos moved');
  assert.match(t.get('T-1').notes[0], /Prune on compaction/);
  assert.equal(t.get('T-1').notes.length, 2, 'a second item for the same todo keeps its own note');
  assert.match(t.get('T-1').notes[1], /Second look/);
  assert.deepEqual(['T-2', 'T-3', 'T-4', 'T-5', 'T-7', 'T-8'].map((id) => t.get(id).area), ['desk', 'desk', 'desk', 'owner', 'desk', 'idea']);
  assert.equal(watchTodos(home).filter((l) => l.set.title).length, 6, 'new todos: T-2, T-99, T-3+T-4, T-5, T-7, T-8');
  // The printed way back works, and a second run over the same file (as after an interrupted run) changes nothing.
  ok(desk(home, 'todo', 'set', 'T-1', '--area', 'desk'));
  const before = readFileSync(tf, 'utf8'), bak = join(home, 'NEXT.md.bak');
  renameSync(bak, join(home, 'NEXT.md'));
  const again = ok(desk(home, 'sync'));
  assert.match(again, /migrated NEXT\.md: 0 rulings, 0 watch todos/);
  assert.doesNotMatch(again, /^moved /m);
  assert.equal(readFileSync(tf, 'utf8'), before);
  assert.equal(fold(lines(tf)).get('T-1').area, 'desk');
});

test('sync migrates NEXT.md (CRLF, unbulleted, undated); partial, interrupted and backed-up runs; a hand TODO.md stays', () => {
  const { root, home } = multiDesk();
  writeFileSync(join(home, 'NEXT.md'), NEXT_B);
  writeFileSync(join(home, 'TODO.md'), '# My todos\n');
  ok(desk(home, 'sync', join(root, 'a')));
  assert.equal(readFileSync(join(home, 'NEXT.md'), 'utf8'), NEXT_B, 'partial sync leaves NEXT.md');
  const out = ok(desk(home, 'sync'));
  assert.match(out, /migrated NEXT\.md: 4 rulings, 2 watch todos \(NEXT\.md\.bak keeps: preamble, Work, Efficiency notes\)/);
  assert.match(out, /kept TODO\.md: not generated by desk/);
  assert.equal(readFileSync(join(home, 'TODO.md'), 'utf8'), '# My todos\n');
  const d = lines(join(home, 'decisions.jsonl'));
  assert.deepEqual(d.map((r) => [r.date, r.todo]), [['2026-11-01', undefined], ['2026-10-30', undefined], [undefined, undefined], ['2026-10-29', undefined]]);
  assert.equal(d[0].text, 'Owner, 2026-11-01: this desk owns only the server; the kit lives elsewhere (T-53 below).');
  assert.deepEqual(watchTodos(home).map((l) => l.set.why), ['The build on the test host after the last merge; check the job log and the deployed version.', 'The nightly job.']);
  // Interrupted: the records are in, NEXT.md was not renamed.
  rmSync(join(home, 'NEXT.md.bak'));
  writeFileSync(join(home, 'NEXT.md'), NEXT_B);
  assert.match(ok(desk(home, 'sync')), /migrated NEXT\.md: 0 rulings, 0 watch todos/);
  assert.equal(lines(join(home, 'decisions.jsonl')).length, 4);
  assert.equal(watchTodos(home).length, 2);
  // A backup is never overwritten.
  writeFileSync(join(home, 'NEXT.md'), 'new\n');
  rmSync(join(home, '.claude', 'synced-permissions.json'), { force: true });
  const r = desk(home, 'sync');
  assert.equal(r.status, 1, 'both files present: a failing exit');
  assert.ok(existsSync(join(home, '.claude', 'synced-permissions.json')), 'the migration failure does not skip the permissions write');
  assert.match(r.stderr, /both exist; not migrated/);
  assert.equal(readFileSync(join(home, 'NEXT.md'), 'utf8'), 'new\n');
  assert.equal(readFileSync(join(home, 'NEXT.md.bak'), 'utf8'), NEXT_B);
});

test('parseNext: todo only from the desk decide prefix; dropped lines and cut items name their section', () => {
  const long = 'x'.repeat(1001);
  const p = parseNext([
    '## Rulings recorded', 'Lead-in line.', '- Owner, 2026-11-01 (T-4): a', '- other (T-9): b', '',
    '## Not yet verified live', '- one', '### Sub', '- two', '',
    '## Other', '- fine', '',
  ].join('\n'));
  assert.deepEqual(p.rulings.map((r) => r.todo), ['T-4', undefined]);
  assert.deepEqual(p.kept, ['Other', 'Rulings recorded', 'Not yet verified live']);
  assert.deepEqual(parseNext(`## Rulings recorded\n- ${long}\n`).kept, ['Rulings recorded']);
  assert.deepEqual(parseNext('## Rulings recorded\n- ok\n\n## Not yet verified live\n- ok\n').kept, []);
});

test('sync patches the shipped AGENTS.md lines (CRLF kept), keeps an edited one and names it', () => {
  const { home } = multiDesk();
  const [a, b, c] = AGENTS_PATCH.keys(), mid = '`desk status`, and the todo of any worktree you take over. Before', mine = 'Read `NEXT.md` twice, my own line.';
  writeFileSync(join(home, 'AGENTS.md'), ['# Desk', '', a, '', b, mid, c, mine, ''].join('\r\n'));
  const out = ok(desk(home, 'sync'));
  assert.match(out, /patched AGENTS\.md: 3 lines/);
  assert.match(out, /AGENTS\.md:8 names NEXT\.md\/TODO\.md: edit by hand/);
  const after = readFileSync(join(home, 'AGENTS.md'), 'utf8');
  assert.equal(after, ['# Desk', '', AGENTS_PATCH.get(a), '', AGENTS_PATCH.get(b), mid, AGENTS_PATCH.get(c), mine, ''].join('\r\n'));
  assert.doesNotMatch(ok(desk(home, 'sync')), /patched/);
  assert.equal(readFileSync(join(home, 'AGENTS.md'), 'utf8'), after, 'second run changes nothing');
});

test('every line the AGENTS.md patch writes is in templates/AGENTS.md; no template line names NEXT.md or TODO.md', () => {
  const tpl = readFileSync(join(KIT, 'templates', 'AGENTS.md'), 'utf8').split(/\r?\n/);
  for (const l of AGENTS_PATCH.values()) assert.ok(tpl.includes(l), l);
  assert.ok(!tpl.some((l) => /NEXT\.md|TODO\.md/.test(l)));
});

test('sync: an existing settings file keeps its mode and a symlinked one stays a symlink', { skip: process.platform === 'win32' }, () => {
  const { root, home } = multiDesk();
  const f = join(root, 'a', '.claude', 'settings.local.json'), real = join(root, 'a', 'real.json');
  ok(desk(home, 'sync'));
  chmodSync(f, 0o600);
  ok(desk(home, 'sync'));
  assert.equal(statSync(f).mode & 0o777, 0o600);
  renameSync(f, real);
  symlinkSync(real, f);
  writeFileSync(real, '{"model":"x"}\n');
  ok(desk(home, 'sync'));
  assert.ok(lstatSync(f).isSymbolicLink());
  assert.ok(JSON.parse(readFileSync(real, 'utf8')).hooks, 'the target was updated');
  assert.deepEqual(readdirSync(dirname(f)).filter((n) => n.endsWith('.tmp')), []);
});

test('writeJson: a failed rename falls back to a plain write and leaves no temp file', () => {
  const dir = tmp(), file = join(dir, 'held.json'), real = fs.renameSync;
  writeFileSync(file, '{"old":1}\n');
  fs.renameSync = () => { throw Object.assign(new Error('held open'), { code: 'EPERM' }); };
  syncBuiltinESMExports();
  try { writeJson(file, { a: 1 }); } finally { fs.renameSync = real; syncBuiltinESMExports(); }
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { a: 1 });
  assert.deepEqual(readdirSync(dir), ['held.json']);
});

test('writeJson: a failed temp write throws and leaves the real file alone', () => {
  const dir = tmp(), file = join(dir, 'kept.json'), real = fs.writeFileSync;
  writeFileSync(file, '{"old":1}\n');
  fs.writeFileSync = (p, ...rest) => { if (String(p).endsWith('.tmp')) throw Object.assign(new Error('full'), { code: 'ENOSPC' }); return real(p, ...rest); };
  syncBuiltinESMExports();
  try { assert.throws(() => writeJson(file, { a: 1 }), /full/); } finally { fs.writeFileSync = real; syncBuiltinESMExports(); }
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { old: 1 });
  assert.deepEqual(readdirSync(dir), ['kept.json']);
});

test('writeJson: a failed rename leaves no temp file; if the plain write fails too, the error is thrown', () => {
  const dir = tmp(), target = join(dir, 'taken');
  mkdirSync(target); // a folder: rename and plain write both fail on it, on every OS
  assert.throws(() => writeJson(target, { a: 1 }));
  assert.deepEqual(readdirSync(dir), ['taken']);
});

test("writeShim: an apostrophe in the desk path is escaped in sh and no cmd shim is written; the sh shim still runs", () => {
  const home = join(tmp(), "it's 100%");
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, 'desk.config.json'), '{}\n'); // `desk home` prints nothing without it
  writeShim(home);
  assert.ok(readFileSync(join(home, 'desk'), 'utf8').includes("DESK_HOME='" + home.replace(/\\/g, '/').replace(/'/g, "'\\''") + "'"));
  assert.ok(!existsSync(join(home, 'desk.cmd')));
  if (process.platform !== 'win32') {
    const r = spawnSync('sh', [join(home, 'desk'), 'home'], { cwd: tmp(), env: { ...process.env, DESK_HOME: '' }, encoding: 'utf8' });
    assert.equal(r.stdout.trim(), home, r.stderr);
  }
});

test('a BOM in desk.config.json: sync exits 0 and check passes', () => {
  const { home } = multiDesk();
  const file = join(home, 'desk.config.json');
  writeFileSync(file, `\uFEFF${readFileSync(file, 'utf8')}`);
  ok(desk(home, 'sync'));
  const c = desk(home, 'check'); // the check's own config read must not report "does not parse"
  ok(c);
  assert.doesNotMatch(c.stdout, /does not parse/);
});
