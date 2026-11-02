import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { copilotAgent, parseFrontmatter, claudeSettings, mergeSettings, AGENTS_PATCH, parseNext } from '../lib/sync.mjs';
import { ghName } from '../lib/init.mjs';
import { multiDesk, desk, git, tmp, KIT, BIN, env } from './helpers.mjs';

const KIT_VERSION = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')).version;
const ok = (r) => { assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`); return r.stdout; };

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
  for (const f of ['AGENTS.md', 'CLAUDE.md', 'agent-rules.md', 'todo.jsonl', 'board.jsonl', 'decisions.jsonl', '.gitignore', 'desk.code-workspace', 'package.json', 'desk', 'desk.cmd']) assert.ok(existsSync(join(home, f)), f);
  for (const f of ['NEXT.md', 'TODO.md']) assert.equal(existsSync(join(home, f)), false, f);
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
  assert.equal(Object.keys(ex).length, 10);
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
  for (const s of readdirSync(join(KIT, 'skills'))) assert.ok(existsSync(join(home, '.github', 'skills', s, 'SKILL.md')), s);
  for (const a of ['archiver', 'implementer', 'reviewer', 'verifier']) assert.ok(existsSync(join(home, '.github', 'agents', `${a}.agent.md`)), a);
  assert.ok(!existsSync(join(home, '.github', 'hooks')), 'no second hook source: Copilot reads the settings hooks');
  const sl = (p) => p.replace(/\\/g, '/'), kitCtx = sl(join(KIT, 'scripts', 'subagent-context.mjs'));
  for (const d of [home, join(root, 'worktrees', 'a-demo')]) {
    assert.equal(JSON.parse(readFileSync(join(d, '.claude', 'settings.local.json'), 'utf8')).hooks.SubagentStart[0].hooks[0].command,
      `node "${kitCtx}" SubagentStart "${sl(home)}" "${sl(d)}"`, 'the running kit (none pinned), the desk and this checkout');
  }
  // the shim runs the desk command from any folder, DESK_HOME unset
  const { status, stdout } = process.platform === 'win32'
    ? spawnSync('cmd', ['/c', join(home, 'desk.cmd'), 'home'], { cwd: tmp(), env: { ...process.env, DESK_HOME: '' }, encoding: 'utf8' })
    : spawnSync('sh', [join(home, 'desk'), 'home'], { cwd: tmp(), env: { ...process.env, DESK_HOME: '' }, encoding: 'utf8' });
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

test('sync: a desk/desk.cmd without the shim marker, or a desk/ folder, is left alone and sync exits 1', () => {
  const { home } = multiDesk();
  writeFileSync(join(home, 'desk.cmd'), 'mine\r\n');
  let r = desk(home, 'sync');
  assert.equal(r.status, 1);
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

test('desk check on a kit without test/ (the npm-installed copy) skips the kit tests and exits 0', () => {
  const kit = join(tmp(), 'agent-desk');
  for (const d of [...JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')).files, 'package.json']) {
    if (existsSync(join(KIT, d))) cpSync(join(KIT, d), join(kit, d), { recursive: true });
  }
  const r = spawnSync(process.execPath, [join(kit, 'bin', 'desk.mjs'), 'check'], { cwd: tmp(), env: { ...process.env, DESK_HOME: '' }, encoding: 'utf8', timeout: 400e3 });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /skip kit tests: not shipped/);
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
