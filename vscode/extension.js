// VS Code glue over desk.js: the sidebar views, their refresh and the Decide walk.
const vscode = require('vscode');
const { findDesk, run, parseStatus, statusTree, nextDecision, decisionPicks, record } = require('./desk');

const VIEWS = ['decisions', 'work', 'todos'];
const EVERY = 60e3;

function treeItem(n) {
  const { Collapsed, Expanded, None } = vscode.TreeItemCollapsibleState;
  const item = new vscode.TreeItem(n.label, n.children?.length ? (n.open ? Expanded : Collapsed) : None);
  item.id = n.id;
  item.description = n.description;
  item.tooltip = n.tooltip;
  if (n.icon) item.iconPath = new vscode.ThemeIcon(n.icon.id, n.icon.color && new vscode.ThemeColor(n.icon.color));
  if (n.decide) item.command = { command: 'agentDesk.decide', title: 'Decide' };
  return item;
}

async function askRuling(d) {
  const title = `${d.id}: ${d.title}`;
  // shortcut: the placeholder cuts a long context; show it in a message first if owners miss the end of it.
  const pick = d.options.length
    ? await vscode.window.showQuickPick(decisionPicks(d), { title, placeHolder: d.context ?? 'Your ruling', ignoreFocusOut: true })
    : { other: true };
  return pick?.other ? vscode.window.showInputBox({ title, prompt: 'Your ruling', ignoreFocusOut: true }) : pick?.label;
}

function activate(context) {
  let desk = null, roots = null, busy = false, again = false, walking = false;
  const changed = new vscode.EventEmitter();
  const views = VIEWS.map((key) => vscode.window.createTreeView(`agentDesk.${key}`, {
    treeDataProvider: { onDidChangeTreeData: changed.event, getTreeItem: treeItem, getChildren: (n) => (n ? n.children ?? [] : roots?.[key] ?? []) },
  }));
  const say = (message) => { for (const view of views) view.message = message; };

  // shortcut: polls while the views are hidden too, so the badge stays true; poll only when visible if the cost shows.
  async function refresh() {
    if (!desk) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const status = parseStatus(await vscode.window.withProgress({ location: { viewId: 'agentDesk.work' } }, () => run(desk, ['status', '--json'])));
      roots = statusTree(status);
      say(undefined);
      views[0].badge = status.decisions.length ? { value: status.decisions.length, tooltip: `${status.decisions.length} owner decision(s) waiting` } : undefined;
      changed.fire();
    } catch (e) {
      say(e.message);
    } finally {
      busy = false;
      if (again) { again = false; void refresh(); }
    }
  }

  // The id is read fresh from `desk decide --json`, not the row's: the row can be a minute old, and a ruling must land on the question the owner read.
  async function decide() {
    if (!desk || walking) return;
    walking = true;
    const home = desk; // the picker can outlive a folder change: all runs go to the desk the walk began on
    try {
      for (;;) {
        const d = await nextDecision(home);
        if (!d) { void vscode.window.showInformationMessage('No owner decisions waiting.'); return; }
        const ruling = await askRuling(d);
        if (!ruling) { void vscode.window.showInformationMessage('Nothing recorded.'); return; }
        await record(home, d.id, ruling);
        void refresh();
      }
    } catch (e) {
      void vscode.window.showErrorMessage(e.message);
    } finally {
      walking = false;
    }
  }

  function findAndRefresh() {
    desk = findDesk((vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath));
    void vscode.commands.executeCommand('setContext', 'agentDesk.inDesk', !!desk);
    if (desk && !roots) say('Loading desk status…');
    void refresh();
  }

  const timer = setInterval(() => void refresh(), EVERY);
  context.subscriptions.push(
    ...views, changed, { dispose: () => clearInterval(timer) },
    vscode.commands.registerCommand('agentDesk.refresh', refresh),
    vscode.commands.registerCommand('agentDesk.decide', decide),
    vscode.workspace.onDidChangeWorkspaceFolders(findAndRefresh),
  );
  findAndRefresh();
}

module.exports = { activate };
