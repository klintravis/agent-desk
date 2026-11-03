## Why

An owner decision is one free-text `--why` split on `;`, and the Desk pane regex-parses the printed text. A `;` in
prose gives bogus options, and an option's whole rationale becomes its label and then the recorded ruling (T-151). The
owner finds it hard to see what to choose, and wants to decide from the VS Code extension too.

## What Changes

- A todo may carry `options: [{label, why}]`, written with a repeatable `--option "<label>: <why>"`, the first being the
  recommended one. 2 to 4 options, labels of at most 60 characters. `why` is then the question's context.
- `desk decide --json` returns the first waiting decision, and `decisions[].options` joins `desk status --json`
  (`v` stays 2). Old todos with only `--why` keep the `;` split.
- The printed `desk decide` shows each option's why under it.
- The Desk pane reads the JSON instead of parsing printed text and puts the whys in the question text. The VS Code
  extension does the same and shows each why as the quick pick row's detail. Choosing an option records its label only.
- `desk tidy` raises its question with real options.
- Every instruction that tells agents how to write a decision uses `--option`.

Not breaking: old pending decisions still display and free-text rulings stay allowed. A pane or extension from this
version needs a desk CLI from this version too; an older one refuses `decide --json` and records nothing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `todos-and-board`: the `options` field and `--option`.
- `desk-cli`: `decide --json`, the printed format, `options` in the status JSON.
- `plugin-ui`: the Decide walk reads JSON; the parity gap with the extension is stated here.
- `vscode-extension`: the Decide walk reads JSON and shows the whys.
- `desk-tidy`: the owner question uses options.

## Impact

`bin/desk.mjs`, `lib/tidy.mjs`, `lib/wt.mjs`, `hooks/pane.tsx`, `vscode/desk.js`, `vscode/extension.js`,
`schemas/todo.schema.json`, `schemas/desk-status.schema.json`, the skills, `templates/AGENTS.md`, README, inventory.
No new dependency.
