import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findDesk, loadConfig, repoFor, wtDir, worktreeList, projectDirName, projectPrefixes, isDeskProject, MODELS, EFFORTS, userSettingsPath, readUserSettings, orchestrateTable, resolveSettings } from '../lib/config.mjs';
import { schema } from '../lib/schema.mjs';
import { tmp, env, NO_USER_SETTINGS } from './helpers.mjs';

const deskWith = (cfg) => { const d = tmp(); writeFileSync(join(d, 'desk.config.json'), JSON.stringify(cfg)); return d; };
const userFile = (content) => { const f = join(tmp(), 'settings.json'); writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content)); return f; };
// No inherited CLAUDE_CODE_* here, so an exact warnings list means what it says.
const resolved = (c, content, more = {}) => resolveSettings(c, { env: {}, file: userFile(content), ...more });

test('the test env points the user file at a temp path that does not exist, in children and this process', () => {
  assert.equal(env('x').AGENT_DESK_SETTINGS, NO_USER_SETTINGS);
  assert.equal(process.env.AGENT_DESK_SETTINGS, NO_USER_SETTINGS);
  assert.ok(NO_USER_SETTINGS.startsWith(realpathSync(tmpdir())));
  assert.equal(existsSync(NO_USER_SETTINGS), false);
});

test('userSettingsPath: the override, an empty override, else under the home folder', () => {
  assert.equal(userSettingsPath({ AGENT_DESK_SETTINGS: 'x.json' }), 'x.json');
  assert.equal(userSettingsPath({ AGENT_DESK_SETTINGS: '' }), '');
  assert.ok(userSettingsPath({}).endsWith(join('.agent-desk', 'settings.json')));
});

test('readUserSettings: no file and an empty path are quiet', () => {
  assert.deepEqual(readUserSettings(join(tmp(), 'missing.json')).warnings, []);
  assert.deepEqual(readUserSettings('').warnings, []);
  assert.equal(resolveSettings({}, { env: {}, file: '' }).active, false);
});

test('readUserSettings: a malformed file or a non-object warns, is ignored and does not throw', () => {
  for (const bad of ['{ "apiKey": "sk-secret', '[]', '"text"', 'null', '3']) {
    const r = resolved({}, bad);
    assert.equal(r.warnings.length, 1, bad);
    assert.equal(r.active, false);
    assert.equal(r.warnings[0].includes('sk-secret'), false, 'the parser message quotes the file');
    assert.equal(r.tasks.review.effort, 'high');
  }
});

test('readUserSettings: a folder in place of the file warns and does not throw', () => {
  const r = resolveSettings({}, { env: {}, file: tmp() });
  assert.equal(r.warnings.length, 1);
  assert.equal(r.active, false);
});

test('readUserSettings: a byte-order mark from a Windows editor still parses', () => {
  assert.equal(resolved({}, '﻿{"tasks":{"review":{"effort":"low"}}}').tasks.review.effort, 'low');
});

test('readUserSettings: unknown keys warn by name, never by value, and have no effect', () => {
  const secret = 'sk-ant-do-not-print-me';
  const c = { repos: [], permissions: { allow: [] } };
  const r = resolved(c, { apiKey: secret, permissions: { allow: [secret] }, check: secret, $schema: 'x', tasks: { review: { effort: 'low', token: secret, agent: secret } }, cache: { apiKey: secret, promptCacheTtl: secret, idleCompaction: secret } });
  const all = JSON.stringify(r);
  assert.equal(all.includes(secret), false);
  for (const name of ['apiKey', 'permissions', 'check', 'token', 'agent', 'promptCacheTtl', 'idleCompaction']) assert.ok(r.warnings.some((w) => w.includes(name)), name);
  assert.equal(r.warnings.some((w) => w.includes('$schema')), false);
  assert.equal(r.tasks.review.effort, 'low');
  assert.equal(r.tasks.review.agent, 'reviewer');
  assert.deepEqual(c.permissions, { allow: [] });
});

test('readUserSettings: one bad value warns and the others apply', () => {
  const r = resolved({}, { tasks: { review: { model: 'claude-opus-4-5', effort: 'low' }, docs: 'x', memo: { effort: 'max' } }, cache: { promptCacheTtl: '5m', subagentPromptCacheTtl: '2h' } });
  assert.equal(r.tasks.review.model, 'opus');
  assert.equal(r.tasks.review.effort, 'low');
  assert.equal(r.tasks.memo.effort, 'max');
  assert.deepEqual({ ...r.cache }, { promptCacheTtl: '5m' });
  assert.equal(r.warnings.length, 3);
  assert.equal(r.warnings.some((w) => w.includes('claude-opus-4-5') || w.includes('2h')), false);
});

test('readUserSettings: only the accepted model names pass', () => {
  for (const model of ['best', 'default', 'opusplan', 'inherit', 'opus[1m]', 'claude-opus-4-5', 'OPUS', 1, null])
    assert.equal(resolved({}, { tasks: { review: { model } } }).active, false, String(model));
  assert.equal(resolved({}, { tasks: { review: { model: 'fable' } } }).tasks.review.model, 'fable');
});

test('readUserSettings: __proto__ and constructor warn as unknown and change no prototype', () => {
  const text = '{ "__proto__": { "polluted": 1 }, "constructor": { "polluted": 1 }, "tasks": { "__proto__": { "model": "haiku" }, "constructor": { "model": "haiku" }, "review": { "__proto__": { "model": "haiku" } } }, "cache": { "__proto__": { "promptCacheTtl": "5m" } } }';
  const r = resolved({}, text);
  assert.equal({}.polluted, undefined);
  assert.equal({}.model, undefined);
  assert.equal(r.active, false);
  assert.equal(r.tasks.review.model, 'opus');
  assert.equal(r.warnings.filter((w) => w.includes('__proto__')).length, 4);
  assert.equal(r.warnings.filter((w) => w.includes('constructor')).length, 2);
});

test('orchestrateTable: every row parses, ids are unique, in the table the kit ships', () => {
  const rows = orchestrateTable();
  assert.deepEqual(rows.map((r) => r.task), ['find', 'ci-summary', 'check-summary', 'close-out', 'scribe', 'docs', 'implement', 'fix-known', 'implement-hard', 'implement-perf', 'refactor', 'propose', 'debug', 'review', 'review-sensitive', 'review-structure', 'fix-verify', 'memo']);
  assert.equal(new Set(rows.map((r) => r.task)).size, rows.length);
  assert.deepEqual(rows.find((r) => r.task === 'memo'), { task: 'memo', agent: 'Plan', model: 'opus', effort: 'high' });
});

test('orchestrateTable: throws on a row that does not parse, and on no table', () => {
  const table = (row) => `## Pick by task\n\n| Id | Task | a | m | e |\n|---|---|---|---|---|\n${row}\n\n## Next\n`;
  assert.deepEqual(orchestrateTable(table('| x | T | `a` | opus | low |')), [{ task: 'x', agent: 'a', model: 'opus', effort: 'low' }]);
  for (const row of ['| x | T | `a` | the strongest model | low |', '| x | T | `a` | opus | huge |', '| T | `a` | opus | low |', '| x | T | a | opus | low |'])
    assert.throws(() => orchestrateTable(table(row)), /does not parse/, row);
  assert.throws(() => orchestrateTable('no table'), /no task table/);
});

test('resolveSettings: kit default, each value with its own source, and shared without the user', () => {
  const none = resolved({}, {});
  assert.deepEqual(none.warnings, []);
  assert.deepEqual([none.tasks.review.model, none.tasks.review.effort, none.tasks.review.source], ['opus', 'high', { model: 'kit', effort: 'kit' }]);
  const r = resolved({ tasks: { review: { model: 'sonnet' } } }, { tasks: { review: { effort: 'medium' } } });
  assert.deepEqual(r.tasks.review, { agent: 'reviewer', task: 'review', model: 'sonnet', effort: 'medium', source: { model: 'desk', effort: 'user' }, shared: { model: 'sonnet', effort: 'high' } });
  assert.equal(r.active, true);
  assert.equal(r.tasks.docs.agent, 'implementer');
});

test('resolveSettings: the user beats the desk', () => {
  const r = resolved({ tasks: { review: { model: 'sonnet' } } }, { tasks: { review: { model: 'haiku' } } });
  assert.deepEqual([r.tasks.review.model, r.tasks.review.source.model, r.tasks.review.shared.model], ['haiku', 'user', 'sonnet']);
});

test('resolveSettings: unknown task ids warn with the id and have no effect, from either layer', () => {
  const r = resolved({ tasks: { gone: { model: 'opus' } }, floor: { retired: { model: 'opus' } } }, { tasks: { nope: { model: 'opus' } } });
  for (const id of ['gone', 'retired', 'nope']) assert.ok(r.warnings.some((w) => w.includes(`"${id}"`)), id);
  assert.equal(r.active, false);
  assert.equal(r.tasks.nope, undefined);
});

test('resolveSettings: the floor beats the user and the desk, records what it replaced, and never lowers', () => {
  const floor = { review: { model: 'opus', effort: 'high' } };
  const user = resolved({ floor }, { tasks: { review: { model: 'sonnet', effort: 'medium' } } }).tasks.review;
  assert.deepEqual(user, { agent: 'reviewer', task: 'review', model: 'opus', effort: 'high', source: { model: 'floor', effort: 'floor' }, replaced: { model: 'sonnet', effort: 'medium' }, shared: { model: 'opus', effort: 'high' } });
  const desk = resolved({ floor, tasks: { review: { effort: 'low' } } }, {}).tasks.review;
  assert.deepEqual([desk.effort, desk.source.effort, desk.replaced, desk.shared.effort], ['high', 'floor', { effort: 'low' }, 'high']);
  const above = resolved({ floor }, { tasks: { review: { model: 'fable', effort: 'max' } } }).tasks.review;
  assert.deepEqual([above.model, above.effort, above.source, above.replaced], ['fable', 'max', { model: 'user', effort: 'user' }, undefined]);
  const equal = resolved({ floor }, {}).tasks.review;
  assert.deepEqual(equal.source, { model: 'kit', effort: 'kit' });
});

test('resolveSettings: the two env overrides warn by name, not value', () => {
  const r = resolveSettings({}, { env: { CLAUDE_CODE_EFFORT_LEVEL: 'lowsecret', CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' }, file: '' });
  assert.ok(r.warnings.some((w) => w.includes('CLAUDE_CODE_EFFORT_LEVEL') && w.includes('floor')));
  assert.ok(r.warnings.some((w) => w.includes('CLAUDE_CODE_SUBAGENT_MODEL_FORCE') && w.includes('floor')));
  assert.equal(r.warnings.join().includes('lowsecret'), false);
});

test('resolveSettings: a user layer holding only cache keys is active', () => {
  const r = resolved({}, { cache: { idleCompaction: false } });
  assert.equal(r.active, true);
  assert.equal(r.cache.idleCompaction, false);
});

test('loadConfig: tasks and floor pass through; bad values, full ids and a fable floor are refused', () => {
  const floor = { review: { model: 'opus', effort: 'high' } };
  assert.deepEqual(loadConfig(deskWith({ floor })).floor, floor);
  assert.equal(loadConfig(deskWith({ tasks: { memo: { model: 'fable' } } })).tasks.memo.model, 'fable');
  assert.equal(loadConfig(deskWith({ tasks: { anything: { effort: 'low' } } })).tasks.anything.effort, 'low', 'ids are the resolver\'s to warn about');
  assert.throws(() => loadConfig(deskWith({ tasks: { review: { model: 'claude-opus-4-5' } } })), /desk\.config\.json: tasks\.review\.model must be one of/);
  assert.throws(() => loadConfig(deskWith({ floor: { review: { effort: 'huge' } } })), /desk\.config\.json: floor\.review\.effort must be one of/);
  assert.throws(() => loadConfig(deskWith({ floor: { review: { model: 'fable' } } })), /floor\.review\.model must be one of haiku, sonnet, opus$/);
});

test('the orders: lowest first, and the schemas cannot drift from them', () => {
  assert.deepEqual(MODELS, ['haiku', 'sonnet', 'opus', 'fable']);
  assert.deepEqual(EFFORTS, ['low', 'medium', 'high', 'xhigh', 'max']);
  const entry = (m) => m.additionalProperties.properties;
  const user = schema('user-settings'), desk = schema('desk-config');
  for (const e of [entry(user.properties.tasks), entry(desk.properties.tasks)]) assert.deepEqual([e.model.enum, e.effort.enum], [MODELS, EFFORTS]);
  const floor = entry(desk.properties.floor);
  assert.deepEqual([floor.model.enum, floor.effort.enum], [MODELS.filter((m) => m !== 'fable'), EFFORTS]);
});

test('findDesk: DESK_HOME wins, else walk up to desk.config.json, else null', () => {
  const d = deskWith({ repos: [] }), deep = join(d, 'x', 'y');
  mkdirSync(deep, { recursive: true });
  assert.equal(findDesk(deep, {}), d);
  assert.equal(findDesk('/', { DESK_HOME: d }), d);
  assert.equal(findDesk(tmp(), {}), null);
});

test('loadConfig: defaults and paths relative to the desk', () => {
  const d = deskWith({ repos: [{ id: 'app', path: '../app' }] });
  const c = loadConfig(d), r = c.repos[0];
  assert.equal(c.home, d);
  assert.equal(c.worktreesDir, join(d, '..', 'worktrees'));
  assert.equal(c.scratchDir, join(d, 'scratch'));
  assert.deepEqual(c.harnesses, ['claude']);
  assert.equal(r.path, join(d, '..', 'app'));
  assert.deepEqual([r.defaultBranch, r.branchPrefix, r.worktreePrefix, r.check], ['main', 'agent/', 'app-', '']);
});

test('loadConfig: outputStyle defaults to Concise, "" is kept, a non-string is refused', () => {
  assert.equal(loadConfig(deskWith({ repos: [] })).outputStyle, 'Concise');
  assert.equal(loadConfig(deskWith({ repos: [], outputStyle: '' })).outputStyle, '');
  assert.throws(() => loadConfig(deskWith({ repos: [], outputStyle: 3 })), /outputStyle must be a string/);
});

test('loadConfig: refuses bad and duplicate ids, a repo without a path, bad JSON', () => {
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'Bad Id', path: '.' }] })), /repos\[0\]\.id/);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: '.' }, { id: 'a', path: '..' }] })), /repos\[1\]\.id/);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a' }] })), /no path/);
  const d = tmp(); writeFileSync(join(d, 'desk.config.json'), '{');
  assert.throws(() => loadConfig(d), /desk\.config\.json/);
});

test('kind: git by default, folder entries have no worktrees, anything else refused', () => {
  const d = deskWith({ worktreesDir: 'wt', repos: [{ id: 'a', path: 'a' }, { id: 'n', path: 'n', kind: 'folder', worktreePrefix: 'n-' }] });
  const c = loadConfig(d);
  assert.deepEqual(c.repos.map((r) => [r.kind, r.gh]), [['git', ''], ['folder', '']]);
  mkdirSync(join(d, 'wt', 'n-x'), { recursive: true }); writeFileSync(join(d, 'wt', 'n-x', '.git'), '');
  assert.deepEqual(worktreeList(c), []);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', kind: 'svn' }] })), /kind must be git or folder/);
});

test('repoFor: --repo, the only repo, or an error naming the choices', () => {
  const one = loadConfig(deskWith({ repos: [{ id: 'a', path: 'a' }] }));
  const two = loadConfig(deskWith({ repos: [{ id: 'a', path: 'a' }, { id: 'b', path: 'b' }] }));
  assert.equal(repoFor(one).id, 'a');
  assert.equal(repoFor(two, 'b').id, 'b');
  assert.throws(() => repoFor(two), /--repo <a\|b>/);
  assert.throws(() => repoFor(two, 'zz'), /no repo "zz"/);
});

test('a worktreePrefix that starts another repo\'s prefix is refused', () => {
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', worktreePrefix: 'x-' }, { id: 'b', path: 'b', worktreePrefix: 'x-b-' }] })), /"x-" \(a\) is a prefix of "x-b-" \(b\)/);
  assert.throws(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', worktreePrefix: 'x-' }, { id: 'b', path: 'b', worktreePrefix: 'x-' }] })), /prefix/);
  assert.doesNotThrow(() => loadConfig(deskWith({ repos: [{ id: 'a', path: 'a', worktreePrefix: 'x-' }, { id: 'n', kind: 'folder', path: 'n', worktreePrefix: 'x-' }] })), 'folders have no worktrees');
});

test('slug -> worktree: prefix per repo, folders without .git skipped, legacy prefix', () => {
  const d = deskWith({ worktreesDir: 'wt', repos: [
    { id: 'kit', path: 'k', worktreePrefix: 'ikit-' }, { id: 'a', path: 'a' }, { id: 'ab', path: 'ab' }] });
  const c = loadConfig(d);
  for (const w of ['ikit-guard-hooks', 'a-one', 'ab-two']) { mkdirSync(join(d, 'wt', w), { recursive: true }); writeFileSync(join(d, 'wt', w, '.git'), 'gitdir: x\n'); }
  mkdirSync(join(d, 'wt', 'ikit-removed')); // left behind by a removal: not open
  mkdirSync(join(d, 'wt', 'other-x'));
  const got = worktreeList(c).map((w) => `${w.repo.id}:${w.slug}`).sort();
  assert.deepEqual(got, ['a:one', 'ab:two', 'kit:guard-hooks']);
  assert.equal(wtDir(c, c.repos[0], 'guard-hooks'), join(d, 'wt', 'ikit-guard-hooks'));
});

test('transcript folders: every non-alphanumeric becomes -, matched case-insensitively', () => {
  assert.equal(projectDirName('C:\\x\\my desk'), 'C--x-my-desk');
  const c = loadConfig(deskWith({ repos: [{ id: 'a', path: '../a' }] }));
  const p = projectPrefixes(c);
  assert.ok(isDeskProject(p, projectDirName(c.home).toUpperCase()));
  assert.ok(isDeskProject(p, projectDirName(join(c.worktreesDir, 'a-x'))));
  assert.ok(!isDeskProject(p, projectDirName(c.home) + 'x'));
});
