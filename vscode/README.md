# Agent Desk for VS Code

The desk's status and owner decisions in the sidebar, for people who run a desk without Claude. No AI: the extension runs the desk's own CLI and shows what it prints.

- **Desk view** in the activity bar: Owner decisions, Active todos, Branches, Claims and Overlaps, from `desk status --json`, refreshed every minute. A badge counts the waiting decisions.
- **Decide** (the toolbar button, or a press on a decision): walks the waiting decisions in a quick pick and records each with `desk decide`. Closing the picker records nothing. A ruling that holds a secret is refused.

## Needs

- A trusted workspace with the desk folder as a root (a folder with `desk.config.json`). The generated `.code-workspace` lists it first.
- The desk's kit installed: `<desk>/node_modules/agent-desk/bin/desk.mjs` (`npm install` in the desk folder).
- `node` 20 or newer on PATH, `gh` for CI state, as for the CLI.

## Try it from a checkout

No build step. Either run it in a dev window:

```
code --extensionDevelopmentPath=<checkout>/vscode <desk folder>
```

or package and install it:

```
cd vscode
npx @vscode/vsce package
code --install-extension agent-desk-<version>.vsix
```
