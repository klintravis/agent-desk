## Why

The pane (`hooks/pane.tsx`) and the VS Code sidebar (`vscode/desk.js`) each re-derived "ready" from the CI and verdict strings of `desk status --json`, a copy of the rule behind `wt merge` (`mergeOk`, `ciConclusion`) that had already drifted: they read only the newest run, not all runs of the head (T-108), and treated `MERGE AFTER FIXES` and `neutral` differently from each other and from the gate (T-150).

## What Changes

- `desk status --json` branches carry `state`, one word computed in the CLI by `branchWord` (`CI failed`, `fixes needed`, `rebase`, `needs review`, `ready`, `CI running`, `CI stale`, `no CI yet`, `CI unknown`). `ready` is the merge gate: every run of the head sha passed (`conclusion()`, now shared with `wt merge`), or the repo has no gh, and `mergeOk` holds. A `verdictOld: true` field marks a verdict naming another commit.
- The pane and the sidebar read `state`; their CI and verdict parsers (`ciColor`, `verdictColor`, the sidebar's `branchState` parsing) are deleted. Colours and ranks per word stay as they were, except two pane changes that follow the gate: `MERGE AFTER FIXES` went from orange to red (`fixes needed`) and a `neutral` run from orange `CI unknown` to red `CI failed`.
- The sidebar's branch description starts with the state word in place of the short CI and verdict.
- Schema `desk-status` gains `state` (required) and `verdictOld`. `v` stays 2: the change only adds fields.

## Capabilities

### Modified Capabilities
- `desk-cli`: status JSON carries the branch state.
- `plugin-ui`: pane colours read it.
- `vscode-extension`: its Status view text is edited in place (the requirement is one long paragraph with unrelated scenarios).

## Decisions

- `wt merge` keeps calling `mergeOk` and `ciConclusion`; `branchWord` calls the same `mergeOk` and `conclusion`, so each has one definition. A test pins both readers to carry no parser.
- An unknown state word falls back to orange (pane) or blue (sidebar), so a newer CLI cannot break an older reader.
