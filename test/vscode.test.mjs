import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { join } from 'node:path';
import { tmp, desk, KIT } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { findDesk, run, parseStatus, statusTree, printedDecision, record } = require('../vscode/desk.js');
const json = (f) => JSON.parse(readFileSync(join(KIT, f), 'utf8'));

// A desk whose node_modules/agent-desk is this checkout, as `file:` pins make it. Decisions T-1 and T-2 wait.
function deskWithKit(todos = [['pick one', 'keep; drop'], ['pick two', 'left; right']]) {
  const home = tmp();
  writeFileSync(join(home, 'desk.config.json'), '{"repos":[]}');
  mkdirSync(join(home, 'node_modules'));
  symlinkSync(KIT, join(home, 'node_modules', 'agent-desk'), 'junction');
  for (const [title, why] of todos) desk(home, 'todo', 'add', title, '--area', 'owner', ...(why ? ['--why', why] : []));
  return home;
}
const rulings = (home) => (existsSync(join(home, 'decisions.jsonl')) ? readFileSync(join(home, 'decisions.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);

test('manifest: id, one version, no dependencies, Workspace Trust, not in the npm package', () => {
  const m = json('vscode/package.json');
  assert.equal(`${m.publisher}.${m.name}`, 'klintravis.agent-desk');
  assert.equal(m.displayName, 'Agent Desk');
  assert.equal(m.version, json('package.json').version);
  assert.equal(m.dependencies, undefined);
  assert.equal(m.type, undefined, 'CommonJS: the root package is ESM and the extension host requires main');
  assert.equal(m.capabilities.untrustedWorkspaces.supported, false, 'it runs code from the workspace');
  assert.equal(m.capabilities.virtualWorkspaces, false);
  assert.ok(!json('package.json').files.some((f) => f.split('/')[0] === 'vscode'));
  for (const f of [m.main, m.contributes.viewsContainers.activitybar[0].icon, 'README.md', 'LICENSE']) assert.ok(existsSync(join(KIT, 'vscode', f)), f);
});

test('findDesk: the first folder holding desk.config.json, or null', () => {
  const a = tmp(), b = tmp(), c = tmp();
  writeFileSync(join(b, 'desk.config.json'), '{}');
  writeFileSync(join(c, 'desk.config.json'), '{}');
  assert.equal(findDesk([a, b, c]), b);
  assert.equal(findDesk([a]), null);
  assert.equal(findDesk([]), null);
});

test('run: says when the kit is missing; DESK_HOME always names this desk; a failure carries stderr', async () => {
  const none = tmp();
  await assert.rejects(run(none, ['status']), /desk\.mjs is missing: run npm install/);
  const home = deskWithKit();
  const was = process.env.DESK_HOME;
  process.env.DESK_HOME = tmp();
  try {
    assert.equal((await run(home, ['home'])).trim(), home);
    await assert.rejects(run(home, ['decide', 'T-99', 'x']), /not a waiting owner decision/);
  } finally {
    if (was === undefined) delete process.env.DESK_HOME; else process.env.DESK_HOME = was;
  }
});

test('run: says when node is not on PATH', async () => {
  const home = deskWithKit();
  const paths = Object.keys(process.env).filter((k) => k.toLowerCase() === 'path');
  const was = paths.map((k) => process.env[k]);
  paths.forEach((k) => { process.env[k] = ''; });
  try {
    await assert.rejects(run(home, ['home']), /node is not on PATH/);
  } finally { paths.forEach((k, i) => { process.env[k] = was[i]; }); }
});

test('parseStatus refuses another status version, and bad JSON', () => {
  assert.throws(() => parseStatus('{"v":3}'), /status v3, this extension reads v2/);
  assert.throws(() => parseStatus('not json'), SyntaxError);
});

test('statusTree draws the real status --json', async () => {
  const home = deskWithKit();
  desk(home, 'todo', 'add', 'a job', '--area', 'desk');
  desk(home, 'todo', 'start', 'T-3');
  const tree = statusTree(parseStatus(await run(home, ['status', '--json'])));
  assert.deepEqual(tree.map((s) => s.label), ['Owner decisions (2)', 'Active todos (1)', 'Branches (0)', 'Claims (0)', 'Overlaps (0)']);
  assert.deepEqual(tree[0].children.map((c) => [c.label, c.decide]), [['T-1 pick one', true], ['T-2 pick two', true]]);
  assert.equal(tree[1].children[0].label, 'T-3 a job');
});

test('statusTree: branch row, claim row, overlaps, and sections the status left null', () => {
  const tree = statusTree({
    decisions: [], active: [{ id: 'T-1', title: 't', status: 'active', state: 'half', next: 'test' }],
    branches: [{ slug: 'x', head: 'abcdef1234', ci: 'CI abcdef1 success', verdict: 'MERGE @abcdef1', behind: { base: 'main', n: 2 }, pr: { number: 7, state: 'OPEN', url: 'u' } }, { slug: 'y', head: '?', ci: 'no CI run', verdict: null, behind: null }],
    claims: [{ slug: 'x', from: 'aaaa' }], overlaps: ['x + y: f'],
  });
  assert.equal(tree[1].children[0].description, 'half');
  assert.equal(tree[1].children[0].tooltip, 't\nstate: half\nnext: test');
  assert.equal(tree[2].children[0].description, 'abcdef1 · CI abcdef1 success · verdict: MERGE @abcdef1 · behind main by 2 · PR #7 OPEN');
  assert.equal(tree[2].children[1].description, '? · no CI run · verdict: none');
  assert.equal(tree[3].children[0].description, 'aaaa');
  assert.equal(tree[4].children[0].label, 'x + y: f');
  assert.equal(statusTree({ decisions: [], active: [], branches: [], claims: [], overlaps: null })[4].label, 'Overlaps (0)');
});

test('printedDecision reads what desk decide really prints', async () => {
  const home = deskWithKit();
  const d = printedDecision(await run(home, ['decide']));
  assert.deepEqual(d, { id: 'T-1', head: 'T-1 (1 of 2): pick one', options: ['keep', 'drop'] });
  assert.equal(printedDecision('No owner decisions waiting.\n'), null);
  assert.deepEqual(printedDecision('T-9 (1 of 1): q\n  (no options given)\nAnswer: x').options, []);
  assert.equal(printedDecision('Recorded T-1: x\n\nT-2 (1 of 1): second\n  Recommended: a').id, 'T-2');
});

test('record: a secret records nothing and neither does a missing check; a ruling is one argv element from the owner', async () => {
  const home = deskWithKit();
  const was = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CLAUDE_CODE_SESSION_ID = 'claudesession';
  try {
    await assert.rejects(record(home, 'T-1', 'use ghp_abcdefghijklmnopqrstuvwxyz0123'), /holds a secret/);
    assert.deepEqual(rulings(home), []);
    const bare = tmp();
    writeFileSync(join(bare, 'desk.config.json'), '{"repos":[]}');
    await assert.rejects(record(bare, 'T-1', 'fine'));
    await record(home, 'T-1', 'keep; a "quoted" & $(odd) --flag');
    assert.deepEqual(rulings(home).map((r) => [r.todo, r.from, r.text]), [['T-1', 'owner', 'keep; a "quoted" & $(odd) --flag']]);
  } finally {
    if (was === undefined) delete process.env.CLAUDE_CODE_SESSION_ID; else process.env.CLAUDE_CODE_SESSION_ID = was;
  }
});

// extension.js against a stand-in for the `vscode` module: wiring only. A real window is a hand check (vscode/README.md).
function loadExtension(folders, answers, onRun = () => {}) {
  const commands = new Map(), messages = [], context = new Map(), asked = [];
  let view, onFolders;
  const next = (kind, opts) => { asked.push([kind, opts]); return Promise.resolve(answers.shift()); };
  const stub = {
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    TreeItem: class { constructor(label, collapsibleState) { Object.assign(this, { label, collapsibleState }); } },
    EventEmitter: class { event = () => {}; fire() { view.fired = (view.fired ?? 0) + 1; } dispose() {} },
    window: {
      createTreeView: (id, o) => (view = { id, provider: o.treeDataProvider, dispose() {} }),
      withProgress: (o, f) => { onRun(); return f(); },
      showQuickPick: (items, o) => next('pick', { items, ...o }),
      showInputBox: (o) => next('input', o),
      showInformationMessage: (m) => messages.push(m),
      showErrorMessage: (m) => messages.push(`error: ${m}`),
    },
    commands: {
      registerCommand: (id, f) => { commands.set(id, f); return { dispose() {} }; },
      executeCommand: (c, k, v) => context.set(k, v),
    },
    workspace: { workspaceFolders: folders.map((fsPath) => ({ uri: { fsPath } })), onDidChangeWorkspaceFolders: (f) => { onFolders = f; return { dispose() {} }; } },
  };
  const load = Module._load;
  Module._load = (r, ...rest) => (r === 'vscode' ? stub : load(r, ...rest));
  delete require.cache[require.resolve('../vscode/extension.js')];
  try {
    const subscriptions = [];
    require('../vscode/extension.js').activate({ subscriptions });
    return { stub, commands, messages, context, asked, subscriptions, view, refolder: (f) => { stub.workspace.workspaceFolders = f.map((fsPath) => ({ uri: { fsPath } })); onFolders(); }, close: () => subscriptions.forEach((s) => s.dispose()) };
  } finally { Module._load = load; }
}

test('extension: every contributed command is registered, and no desk means no view and no run', async () => {
  const x = loadExtension([tmp()], []);
  try {
    assert.deepEqual([...x.commands.keys()].sort(), json('vscode/package.json').contributes.commands.map((c) => c.command).sort());
    assert.equal(x.context.get('agentDesk.inDesk'), false);
    await x.commands.get('agentDesk.decide')();
    await x.commands.get('agentDesk.refresh')();
    assert.deepEqual(x.messages, []);
    assert.deepEqual(x.view.provider.getChildren(), []);
  } finally { x.close(); }
});

test('extension: draws the tree and the badge, walks the decisions, records, then ends', async () => {
  const home = deskWithKit();
  const x = loadExtension([home], ['drop', 'Other…', 'neither, wait']);
  try {
    assert.equal(x.context.get('agentDesk.inDesk'), true);
    assert.equal(x.view.message, 'Loading desk status…');
    await x.commands.get('agentDesk.refresh')(); // waits only for its own turn: the one activate started is in flight
    await waitFor(() => x.view.provider.getChildren().length);
    assert.equal(x.view.message, undefined);
    assert.equal(x.view.badge.value, 2);
    const [decisions, active] = x.view.provider.getChildren();
    const row = x.view.provider.getChildren(decisions)[0];
    assert.equal(x.view.provider.getTreeItem(decisions).collapsibleState, 2);
    assert.equal(x.view.provider.getTreeItem(active).collapsibleState, 0, 'an empty section has no twisty');
    assert.equal(x.view.provider.getTreeItem(row).label, 'T-1 pick one');
    assert.equal(x.view.provider.getTreeItem(row).command.command, 'agentDesk.decide');

    await x.commands.get('agentDesk.decide')();
    assert.deepEqual(rulings(home).map((r) => [r.todo, r.text]), [['T-1', 'drop'], ['T-2', 'neither, wait']]);
    assert.deepEqual(x.asked[0][1].items, ['keep', 'drop', 'Other…']);
    assert.equal(x.asked[0][1].title, 'T-1 (1 of 2): pick one');
    assert.equal(x.asked[0][1].placeHolder, 'Recommended: keep');
    assert.equal(x.asked[2][0], 'input');
    assert.equal(x.messages.length, 1);
    assert.match(x.messages[0], /No owner decisions waiting\.$/);
    await waitFor(() => !x.view.badge);
  } finally { x.close(); }
});

test('extension: closing the picker records nothing; a secret ends the walk with an error; a failing refresh shows in the view', async () => {
  const home = deskWithKit();
  const x = loadExtension([home], [undefined, 'Other…', 'ghp_abcdefghijklmnopqrstuvwxyz0123']);
  try {
    await x.commands.get('agentDesk.decide')();
    assert.deepEqual(x.messages, ['Nothing recorded.']);
    await x.commands.get('agentDesk.decide')();
    assert.match(x.messages[1], /^error: .*holds a secret/);
    assert.deepEqual(rulings(home), []);
    await waitFor(() => x.view.provider.getChildren().length);
    const bare = tmp();
    writeFileSync(join(bare, 'desk.config.json'), '{"repos":[]}');
    x.refolder([bare]);
    await waitFor(() => /is missing/.test(x.view.message ?? ''));
    assert.equal(x.view.provider.getChildren().length, 5, 'the last tree stays');
  } finally { x.close(); }
});

test('extension: one walk at a time', async () => {
  const x = loadExtension([deskWithKit()], [undefined]);
  try {
    const decide = x.commands.get('agentDesk.decide');
    await Promise.all([decide(), decide()]);
    assert.deepEqual(x.messages, ['Nothing recorded.']);
    assert.equal(x.asked.length, 1);
  } finally { x.close(); }
});

test('extension: a decision with no options asks in an input box', async () => {
  const x = loadExtension([deskWithKit([['free text', '']])], [undefined]);
  try {
    await x.commands.get('agentDesk.decide')();
    assert.equal(x.asked[0][0], 'input');
    assert.equal(x.asked[0][1].title, 'T-1 (1 of 1): free text');
  } finally { x.close(); }
});

test('extension: refreshes asked during a run cause exactly one more run, well before the timer', async () => {
  let runs = 0;
  const x = loadExtension([deskWithKit()], [], () => runs++);
  try {
    assert.equal(runs, 1, 'activate started the first run');
    const refresh = x.commands.get('agentDesk.refresh');
    await Promise.all([refresh(), refresh()]); // both land while run 1 is in flight
    await waitFor(() => x.view.fired === 2, 20e3); // run 2 finished: it fires once on success; under the 60 s timer, or the timer could stand in for it
    await new Promise((r) => setImmediate(r)); // a re-run would start in run 2's finally, before this
    assert.equal(runs, 2, 'one more run, not one per request');
  } finally { x.close(); }
});

test('extension: a walk records to the desk it began on, even if the folder changes under the picker', async () => {
  const home = deskWithKit(), other = deskWithKit();
  let answer;
  const x = loadExtension([home], [new Promise((r) => { answer = r; })]);
  try {
    const walk = x.commands.get('agentDesk.decide')();
    await waitFor(() => x.asked.length === 1);
    x.refolder([other]);
    answer('drop');
    await walk;
    assert.deepEqual(rulings(home).map((r) => [r.todo, r.text]), [['T-1', 'drop']]);
    assert.deepEqual(rulings(other), []);
  } finally { x.close(); }
});

async function waitFor(ok, ms = 60e3) {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error(`waited ${ms} ms for ${ok}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}
