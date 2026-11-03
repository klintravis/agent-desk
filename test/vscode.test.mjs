import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { join } from 'node:path';
import { tmp, desk, KIT } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { findDesk, run, parseStatus, statusTree, nextDecision, decisionPicks, record } = require('../vscode/desk.js');
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
  assert.deepEqual(m.contributes.views.agentDesk.map((v) => [v.id, v.name]), [['agentDesk.decisions', 'Decisions'], ['agentDesk.work', 'Work'], ['agentDesk.todos', 'Todos']]);
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
  assert.throws(() => parseStatus('{"v":2,"branches":[{"slug":"x"}]}'), /without a state.*update whichever is older/);
});

test('statusTree draws the real status --json', async () => {
  const home = deskWithKit();
  desk(home, 'todo', 'add', 'a job', '--area', 'desk');
  desk(home, 'todo', 'start', 'T-3');
  const tree = statusTree(parseStatus(await run(home, ['status', '--json'])));
  assert.deepEqual(tree.decisions.map((c) => [c.label, c.decide]), [['T-1 pick one', true], ['T-2 pick two', true]]);
  assert.equal(tree.todos[0].label, 'a job');
  assert.match(tree.todos[0].tooltip, /^T-3 a job/);
  assert.equal(tree.work[0].label, 'Nothing in progress');
});

test('parseStatus: a CLI older than the todos field is refused with what to do', () => {
  assert.throws(() => parseStatus(JSON.stringify({ v: 2, branches: [] })), /without todos.*update whichever is older/);
});

const empty = { decisions: [], active: [], todos: [], branches: [], claims: [], overlaps: [], sessions: [] };
const head = 'abcdef1234';
const br = (slug, state, extra = {}) => ({ slug, head, ci: 'CI abcdef1 success', state, verdict: 'MERGE @abcdef1', behind: null, ...extra });
const work = (s) => statusTree(s).work;

test('statusTree: one Work row per branch or claim, with the todos on that slug', () => {
  const rows = work({
    ...empty,
    active: [{ id: 'T-1', title: 'long title', summary: 'short', status: 'active', state: 'half', next: 'test', slug: 'x' }, { id: 'T-2', title: 'no slug', status: 'active' }],
    branches: [br('x', 'rebase', { behind: { base: 'main', n: 2 }, pr: { number: 7, state: 'OPEN' } }), br('b', 'no CI yet', { ci: 'no CI run', verdict: null })],
    claims: [{ slug: 'x', from: 'aaaa' }, { slug: 'c', from: 'bbbb' }],
  });
  assert.deepEqual(rows.map((r) => r.label), ['short', 'b', 'c']);
  assert.equal(rows[0].description, 'rebase · behind main by 2 · PR #7 OPEN');
  assert.equal(rows[0].tooltip, 'T-1 long title\nstate: half\nnext: test\nbranch x @abcdef1: CI abcdef1 success; verdict: MERGE @abcdef1\nheld by aaaa');
  assert.deepEqual(rows.slice(1).map((r) => r.description), ['no CI yet', 'claimed']);
});

test('statusTree: Todos draws status.todos in its order, each with its id, area and any status but open', () => {
  const { todos } = statusTree({ ...empty, todos: [
    { id: 'T-1', title: 'long', summary: 'short', status: 'open', area: 'adesk', state: 'half' },
    { id: 'T-2', title: 'stuck', status: 'blocked', area: 'desk' },
    { id: 'T-3', title: 'no slug', status: 'active' },
    { id: 'T-4', title: 'on a branch', status: 'blocked', area: 'adesk', slug: 'x', owner: 'me' },
    { id: 'T-5', title: 'owned', status: 'open', area: 'adesk', owner: 'me' },
  ] });
  // As the pane: status, then wt:<slug>, else owner, else area.
  assert.deepEqual(todos.map((r) => [r.label, r.description, r.icon.id]), [
    ['short', 'T-1 · adesk', 'circle-large-outline'], ['stuck', 'T-2 · blocked · desk', 'circle-slash'], ['no slug', 'T-3 · active', 'circle-large-filled'],
    ['on a branch', 'T-4 · blocked · wt:x', 'circle-slash'], ['owned', 'T-5 · me', 'circle-large-outline'],
  ]);
  assert.equal(todos[0].tooltip, 'T-1 long\nstate: half');
});

test('statusTree: Decisions lists each option with its why, the first marked; a decision without options still opens the walk', () => {
  const { decisions } = statusTree({ ...empty, decisions: [{ id: 'T-1', title: 'q', options: [{ label: 'keep', why: 'it works' }, { label: 'drop' }] }, { id: 'T-2', title: 'r' }] });
  assert.deepEqual(decisions[0].children.map((o) => [o.label, o.description, o.tooltip]), [['keep', 'Recommended · it works', 'it works'], ['drop', '', undefined]]);
  assert.deepEqual(decisions[1].children, []);
  assert.deepEqual(decisions.map((d) => d.decide), [true, true]);
  assert.equal(statusTree(empty).decisions[0].label, 'No decisions waiting');
});

test('a todo shows in Work or in Todos, never both and never neither, from the real status --json', async () => {
  const home = deskWithKit();
  for (const [title, ...rest] of [['on a tree', '--area', 'desk'], ['loose', '--area', 'desk'], ['waiting', '--area', 'desk'], ['a thought', '--area', 'idea']]) desk(home, 'todo', 'add', title, ...rest);
  // A claim is open only while its worktree folder exists.
  writeFileSync(join(home, 'desk.config.json'), JSON.stringify({ worktreesDir: 'wts', repos: [{ id: 'kit', path: '../kit', worktreePrefix: 'kit-' }] }));
  mkdirSync(join(home, 'wts', 'kit-tree'), { recursive: true });
  writeFileSync(join(home, 'wts', 'kit-tree', '.git'), 'gitdir: x\n');
  desk(home, 'board', 'post', 'claim', 'tree', 'from test');
  desk(home, 'todo', 'start', 'T-3', '--slug', 'tree');
  desk(home, 'todo', 'start', 'T-4');
  const s = parseStatus(await run(home, ['status', '--json']));
  const tree = statusTree(s);
  assert.deepEqual([tree.work[0].label, tree.work[0].tooltip.split('\n')[0]], ['on a tree', 'T-3 on a tree']);
  assert.deepEqual(tree.todos.map((r) => r.label), ['loose', 'waiting']);
  assert.deepEqual(s.todos.map((x) => x.id), ['T-4', 'T-5']);
  assert.deepEqual(tree.decisions.map((r) => r.label), ['T-1 pick one', 'T-2 pick two']);
});

test('statusTree: Work sections in the pane order, branches most urgent first, a blocked todo with a slug stays out', () => {
  const s = { ...empty, overlaps: ['x + y: f'], sessions: [{ session: 'abc', agents: [] }], prs: [{ slug: 'a', number: 3, decision: 'APPROVED', comments: 0, unresolved: 0, sinceHead: 0 }],
    todos: [{ id: 'T-9', title: 'held', status: 'blocked', slug: 'zeta' }],
    branches: [br('a', 'ready'), br('zeta', 'CI failed'), br('m', 'rebase')] };
  assert.deepEqual(work(s).map((n) => n.label), ['zeta', 'm', 'a', 'Pull requests (1)', 'Overlaps (1)', 'Running sessions (1)']);
  assert.deepEqual(statusTree(s).todos.map((n) => n.id), ['todo:T-9']);
  assert.equal(work(s).find((n) => n.id === 'work:zeta').children.length, 0);
});

test('statusTree: Pull requests as the pane card, an open PR said once', () => {
  const pr = { slug: 'x', number: 7, decision: 'CHANGES_REQUESTED', comments: 2, unresolved: 1, sinceHead: 3 };
  const rows = (state) => work({ ...empty, prs: [pr], branches: [br('x', 'needs review', { pr: { number: 7, state } })] });
  let [row, card] = rows('OPEN');
  assert.equal(row.description, 'needs review'); // no OPEN note on the branch row
  assert.deepEqual([card.label, card.children[0].label, card.children[0].icon.color], ['Pull requests (1)', 'x #7', 'charts.red']);
  assert.equal(card.children[0].description, 'review changes requested · 2 comment(s) · 1 unresolved · 3 new since the head commit · a person merges');
  [row, card] = rows('MERGED');
  assert.equal(row.description, 'needs review · PR #7 MERGED'); // other states stay on the row
  assert.ok(!card.children[0].description.includes('a person merges'));
});

test('statusTree: several todos on one slug are one row with children', () => {
  const rows = work({ ...empty, active: [{ id: 'T-1', title: 'a', slug: 'x' }, { id: 'T-2', title: 'b', summary: 'bee', slug: 'x' }], branches: [br('x', 'no CI yet')] });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].label, rows[0].description], ['x', '2 todos · no CI yet']);
  assert.deepEqual(rows[0].children.map((c) => [c.label, c.description]), [['a', 'T-1'], ['bee', 'T-2']]);
});

test('statusTree: row colour reads only the state word the CLI computed', () => {
  const colour = (state) => work({ ...empty, branches: [br('x', state, { ci: 'ignored', verdict: 'ignored' })] })[0].icon.color;
  for (const [state, want] of [['ready', 'green'], ['CI running', 'yellow'], ['needs review', 'yellow'], ['rebase', 'yellow'], ['CI failed', 'red'], ['fixes needed', 'red'],
    ['CI stale', 'blue'], ['no CI yet', 'blue'], ['CI unknown', 'blue']]) assert.equal(colour(state), `charts.${want}`, state);
  assert.equal(work({ ...empty, claims: [{ slug: 'x', from: 'abc' }] })[0].icon.color, 'charts.blue');
});

test('statusTree: sessions as title and agent count, null sessions, hidden empty sections', () => {
  const tree = work({ ...empty, sessions: [
    { session: 'abc123', title: 'Fix ext', slug: 'ext', agents: [{ type: 'implementer', about: 'T-1' }, { type: 'reviewer', about: '' }] },
    { session: 'def456', agents: [] },
  ] });
  assert.deepEqual(tree.map((n) => n.label), ['Running sessions (2)']);
  assert.deepEqual(tree[0].children.map((c) => [c.label, c.description]), [['Fix ext', '2 agents'], ['def456', undefined]]);
  assert.equal(tree[0].children[0].tooltip, 'Fix ext (abc123)');
  assert.deepEqual(tree[0].children[0].children.map((c) => [c.label, c.description]), [['implementer', 'T-1'], ['reviewer', undefined]]);
  assert.deepEqual(work({ ...empty, sessions: null }).map((n) => n.label), ['Running sessions (unavailable)']);
  assert.deepEqual(work(empty).map((n) => n.label), ['Nothing in progress']);
  assert.deepEqual(work({ ...empty, overlaps: null }).map((n) => n.label), ['Overlaps (unavailable)']);
  const o = work({ ...empty, overlaps: ['x + y: f'], branches: [br('x', 'ready')] });
  assert.deepEqual(o.map((n) => [n.label, n.open]), [['x', undefined], ['Overlaps (1)', false]]);
  assert.equal(o[1].icon.id, 'warning');
});

test('nextDecision reads what desk decide --json really prints, and null when none waits', async () => {
  const home = deskWithKit([['pick one', 'keep; drop']]);
  assert.deepEqual(await nextDecision(home), { id: 'T-1', title: 'pick one', context: null, options: [{ label: 'keep' }, { label: 'drop' }] });
  await record(home, 'T-1', 'keep');
  assert.equal(await nextDecision(home), null);
});

test('decisionPicks: the label is what a choice records, the recommended first and marked, the why as detail, a free-text row last', () => {
  assert.deepEqual(decisionPicks({ options: [{ label: 'Refuse', why: 'safe' }, { label: 'Other…' }] }), [
    { label: 'Refuse', description: 'Recommended', detail: 'safe' },
    { label: 'Other…', description: undefined, detail: undefined },
    { label: 'Other…', other: true },
  ]);
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
  const views = [];
  let onFolders;
  const next = (kind, opts) => { asked.push([kind, opts]); return Promise.resolve(answers.shift()); };
  const stub = {
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class { constructor(id, color) { Object.assign(this, { id, color }); } },
    ThemeColor: class { constructor(id) { this.id = id; } },
    TreeItem: class { constructor(label, collapsibleState) { Object.assign(this, { label, collapsibleState }); } },
    EventEmitter: class { event = () => {}; fire() { views[0].fired = (views[0].fired ?? 0) + 1; } dispose() {} },
    window: {
      createTreeView: (id, o) => { views.push({ id, provider: o.treeDataProvider, dispose() {} }); return views.at(-1); },
      withProgress: (o, f) => { onRun(); return f(); },
      showQuickPick: (items, o) => next('pick', { items, ...o }).then((a) => items.find((i) => i.label === a && (a === 'Other…') === !!i.other)),
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
    return { stub, commands, messages, context, asked, subscriptions, views, view: views[0], refolder: (f) => { stub.workspace.workspaceFolders = f.map((fsPath) => ({ uri: { fsPath } })); onFolders(); }, close: () => subscriptions.forEach((s) => s.dispose()) };
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
    assert.deepEqual(x.views.map((v) => [v.id, v.provider.getChildren()]), [['agentDesk.decisions', []], ['agentDesk.work', []], ['agentDesk.todos', []]]);
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
    assert.deepEqual(x.views.map((v) => v.badge?.value), [2, undefined, undefined]);
    assert.deepEqual(x.views.map((v) => v.message), [undefined, undefined, undefined]);
    assert.deepEqual([x.views[1].provider.getChildren()[0].label, x.views[2].provider.getChildren()[0].label], ['Nothing in progress', 'No open todos']);
    const [row] = x.view.provider.getChildren();
    assert.equal(x.view.provider.getTreeItem(row).collapsibleState, 2);
    assert.deepEqual(x.view.provider.getChildren(row).map((o) => [o.label, o.description]), [['keep', 'Recommended'], ['drop', '']]);
    assert.equal(x.view.provider.getTreeItem(row).label, 'T-1 pick one');
    assert.deepEqual([x.view.provider.getTreeItem(row).iconPath.id, x.view.provider.getTreeItem(row).iconPath.color.id], ['question', 'charts.orange']);
    assert.equal(x.view.provider.getTreeItem(row).command.command, 'agentDesk.decide');

    await x.commands.get('agentDesk.decide')();
    assert.deepEqual(rulings(home).map((r) => [r.todo, r.text]), [['T-1', 'drop'], ['T-2', 'neither, wait']]);
    assert.deepEqual(x.asked[0][1].items.map((i) => i.label), ['keep', 'drop', 'Other…']);
    assert.equal(x.asked[0][1].items[0].description, 'Recommended');
    assert.equal(x.asked[0][1].title, 'T-1: pick one');
    assert.equal(x.asked[2][0], 'input');
    assert.deepEqual(x.messages, ['No owner decisions waiting.']);
    await waitFor(() => !x.view.badge);
  } finally { x.close(); }
});

test('extension: a decision with stored options shows context and whys, and a choice records the label only (T-151)', async () => {
  const home = deskWithKit([]);
  desk(home, 'todo', 'add', 'Guard', '--area', 'owner', '--why', 'A hidden push; or not',
    '--option', 'Refuse: a hidden push cannot slip through, at the cost of rare false refusals; also from any directory',
    '--option', 'Allow as before: no false refusals');
  const x = loadExtension([home], ['Allow as before']);
  try {
    await x.commands.get('agentDesk.decide')();
    assert.equal(x.asked[0][1].placeHolder, 'A hidden push; or not');
    assert.deepEqual(x.asked[0][1].items.map((i) => [i.label, i.detail]), [
      ['Refuse', 'a hidden push cannot slip through, at the cost of rare false refusals; also from any directory'],
      ['Allow as before', 'no false refusals'],
      ['Other…', undefined],
    ]);
    assert.deepEqual(rulings(home).map((r) => [r.todo, r.text]), [['T-1', 'Allow as before']]);
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
    assert.ok(x.view.provider.getChildren().length >= 1, 'the last tree stays');
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
    assert.equal(x.asked[0][1].title, 'T-1: free text');
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
