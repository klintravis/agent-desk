// VS Code glue over desk.js: the sidebar view, its refresh and the Decide walk.
const vscode = require('vscode');
const { findDesk, run, parseStatus, statusTree, printedDecision, record } = require('./desk');

const VIEW = 'agentDesk.status';
const EVERY = 60e3;
const OTHER = 'Other…';

function treeItem(n) {
  const { Collapsed, Expanded, None } = vscode.TreeItemCollapsibleState;
  const item = new vscode.TreeItem(n.label, n.children?.length ? (n.open ? Expanded : Collapsed) : None);
  item.id = n.id;
  item.description = n.description;
  item.tooltip = n.tooltip;
  if (n.decide) item.command = { command: 'agentDesk.decide', title: 'Decide' };
  return item;
}

async function askRuling(d) {
  const pick = d.options.length
    ? await vscode.window.showQuickPick([...d.options, OTHER], { title: d.head, placeHolder: `Recommended: ${d.options[0]}`, ignoreFocusOut: true })
    : OTHER;
  return pick === OTHER ? vscode.window.showInputBox({ title: d.head, prompt: 'Your ruling', ignoreFocusOut: true }) : pick;
}

function activate(context) {
  let desk = null, roots = [], busy = false, again = false, walking = false;
  const changed = new vscode.EventEmitter();
  const view = vscode.window.createTreeView(VIEW, {
    treeDataProvider: { onDidChangeTreeData: changed.event, getTreeItem: treeItem, getChildren: (n) => (n ? n.children ?? [] : roots) },
  });

  // shortcut: polls while the view is hidden too, so the badge stays true; poll only when visible if the cost shows.
  async function refresh() {
    if (!desk) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const status = parseStatus(await vscode.window.withProgress({ location: { viewId: VIEW } }, () => run(desk, ['status', '--json'])));
      roots = statusTree(status);
      view.message = undefined;
      view.badge = status.decisions.length ? { value: status.decisions.length, tooltip: `${status.decisions.length} owner decision(s) waiting` } : undefined;
      changed.fire();
    } catch (e) {
      view.message = e.message;
    } finally {
      busy = false;
      if (again) { again = false; void refresh(); }
    }
  }

  // The id is the one `desk decide` printed, not the row's: the row can be a minute old, and a ruling must land on the question the owner read.
  async function decide() {
    if (!desk || walking) return;
    walking = true;
    const home = desk; // the picker can outlive a folder change: both runs go to the desk the walk began on
    try {
      let text = await run(home, ['decide']);
      for (;;) {
        const d = printedDecision(text);
        if (!d) { void vscode.window.showInformationMessage(text.trim()); return; }
        const ruling = await askRuling(d);
        if (!ruling) { void vscode.window.showInformationMessage('Nothing recorded.'); return; }
        text = await record(home, d.id, ruling);
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
    if (desk && !roots.length) view.message = 'Loading desk status…';
    void refresh();
  }

  const timer = setInterval(() => void refresh(), EVERY);
  context.subscriptions.push(
    view, changed, { dispose: () => clearInterval(timer) },
    vscode.commands.registerCommand('agentDesk.refresh', refresh),
    vscode.commands.registerCommand('agentDesk.decide', decide),
    vscode.workspace.onDidChangeWorkspaceFolders(findAndRefresh),
  );
  findAndRefresh();
}

module.exports = { activate };
