## Why

The owner wants what counts as work (agents in progress), the todos and the decisions split apart, with no information
shown twice, and the Claude plugin and the VS Code extension alike in layout and function where both can be (T-155). Today
the pane has Work, Branches and Sessions tabs with decisions above them, the extension has one tree with sections, and
`desk status --json` carries only active todos, so neither surface can list what is open.

## What Changes

- `desk status --json` gains `todos`: open, blocked and active todos that are not in Work and are not owner decisions or
  ideas, by priority. An active todo on a branch or a claim is in Work and not in `todos`. `v` stays 2. The printed screen
  does not change.
- Both surfaces show three panels, same names and order: **Decisions**, **Work**, **Todos**.
- The extension: three `views` entries, so they are real collapsible panels. Decision rows expand to their options and
  whys. It refuses a status with no `todos`, saying to update whichever is older.
- The pane: three tabs. Decisions move from above the tabs to their tab, with options and whys; the tab shows a yellow dot
  while one waits, so a closed tab hides nothing. Work holds branches and claims with their todos, agents, pull requests,
  overlaps and running sessions. Todos lists at most ten, then `+n more`. Tokens and Roots move to the rows above the tabs,
  since they are not work. The Sessions and Branches tabs go.
- The real differences between the surfaces are stated in the specs as gaps. T-144's ruling stands: the extension's five
  smallest options stay.

## Capabilities

### Modified Capabilities

- `desk-cli`: the `todos` field of `desk status --json`.
- `plugin-ui`: the pane's tabs, their sections, the rows above them and the gaps.
- `vscode-extension`: three views instead of one tree, and the gaps.

## Impact

`bin/desk.mjs`, `schemas/desk-status.schema.json`, `types/index.d.ts`, `hooks/pane.tsx`, `vscode/desk.js`,
`vscode/extension.js`, `vscode/package.json`. The extension's single `agentDesk.status` view is replaced; VS Code forgets
its position in the sidebar. A stored pane tab value is dropped by the atom's shape tag and the pane opens on Work.
