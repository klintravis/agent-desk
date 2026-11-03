# Agent Desk for VS Code

The desk's status and owner decisions in the sidebar, for people who run a desk without Claude. No AI: the extension runs the desk's own CLI and shows what it prints.

Three collapsible views in the activity bar, the same panels as the Claude plugin's Desk pane, from `desk status --json`, refreshed every minute:

- **Decisions**: each waiting decision with its options and whys. A badge counts them.
- **Work**: agents in progress (one row per branch or claim: its todos, branch and claim joined on the slug, with an icon that is green when CI passed (or the repo has no CI info) and a `MERGE` verdict covers the head of a branch that is not behind, yellow while CI runs, or CI passed but there is no `MERGE` verdict for the head or the branch is behind, red when CI failed or any other verdict covers the head, blue otherwise), Pull requests (the review state of each open PR, with `a person merges`), Overlaps (`unavailable` when the check failed) and Running sessions (Claude sessions only, read from their transcripts; `unavailable` when they cannot be read). Branches are most urgent first. Empty sections are hidden.
- **Todos**: what is open and not in Work, active first, then by priority, each as `<id> · <status unless open> · wt:<slug>, else owner, else area`. Owner decisions and idle ideas stay out.
- **Decide** (the Decisions toolbar button, or a press on a decision): walks the waiting decisions in a quick pick, the recommended option first and marked, each option's why under its label, and **Other…** for your own words in an input box. A choice records the option's label with `desk decide`. Closing the picker records nothing. A ruling that holds a secret is refused.

## Needs

- A trusted workspace with the desk folder as a root (a folder with `desk.config.json`). The generated `.code-workspace` lists it first.
- The desk's kit installed: `<desk>/node_modules/agent-desk/bin/desk.mjs` (`npm install` in the desk folder).
- `node` 20 or newer on PATH, `gh` for CI state, as for the CLI.

## Install

Download `agent-desk-vX.Y.Z.vsix` from the [GitHub release](https://github.com/klintravis/agent-desk/releases), then run `code --install-extension agent-desk-vX.Y.Z.vsix`.

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
