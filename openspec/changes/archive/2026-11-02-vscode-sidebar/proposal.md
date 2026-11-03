## Why

The Desk pane, the decisions band, `/desk` and `/decide` are Claude Code only (README, Claude Code and GitHub Copilot). Someone who runs a desk from VS Code without Claude has only the terminal: no view of waiting decisions, active todos and branches. T-87 scoped this; owner ruling T-89 settled how it ships.

## What Changes

- New VS Code extension in `vscode/`, id `klintravis.agent-desk`, display name Agent Desk. Plain CommonJS with no build step, no runtime dependencies and the kit's version.
- An activity-bar view, shown when a workspace root holds `desk.config.json`: Owner decisions, Active todos, Branches, Claims, Overlaps, from `desk status --json`. It refreshes every 60 seconds and on a button, with a badge counting waiting decisions.
- A Decide command that walks the waiting decisions in a quick pick, parsing `desk decide` output the way `hooks/pane.tsx` does, and records through `desk decide T-n <ruling>`. Refuses a ruling that holds a secret.
- The extension holds no desk logic. It runs `node <desk>/node_modules/agent-desk/bin/desk.mjs` with `DESK_HOME` set to the desk. Workspace Trust gates it, since that file comes from the workspace.
- `vscode/` stays out of the npm package's `files`, so desks never install it.

Not in this change: AI features, a chat participant, Copilot Chat integration, an MCP server, Marketplace publishing, attaching the vsix to a release, any new desk CLI flag.

## Capabilities

### New Capabilities

- `vscode-extension`: the sidebar view, its refresh, the Decide walk, how it finds and runs the desk CLI, and how it ships.

### Modified Capabilities

- `release`: `bump`, `notes` and the version consistency test cover `vscode/package.json` as a third version file (open question 6).

## Impact

- New files under `vscode/`; `test/vscode.test.mjs` runs in `npm test`.
- `.gitignore` gains `*.vsix`.
- README gains a short section; the Copilot feature table's Desk pane cell changes.
- The kit's desk CLI and plugin behaviour do not change; `scripts/release.mjs` gains the third version file.

## Open questions

Each took the smallest option; the owner can change any of them.

1. **Which `node`.** The extension runs `node` from PATH, as the `desk` shim does, and says so when it is missing. It does not use VS Code's own runtime or add a setting for the path.
2. **Sections shown.** Running sessions and tokens are left out: they read Claude transcripts, so they say nothing to the user this view is for. Roots are left out too: they rarely change. The pane's state words, colours and meters are not ported, since that would reimplement desk logic; `ci` and `verdict` show as the CLI gives them.
3. **Secret in a ruling.** The pane masks a secret and records the rest. The sidebar refuses and records nothing, using the kit's own `hasSecret` from `hooks/secretpatterns.mjs`, because masking would need `hooks/redact.ts`, which is TypeScript. A shell `desk decide` still has no such check.
4. **Polling while hidden.** The status runs every 60 seconds even when the view is hidden, so the badge stays true. One run took about 9 seconds on the dogfood desk, and each run calls `gh`, as the pane does.
5. **Finding the desk.** Only workspace roots are searched, not their parents, and no setting names a desk elsewhere. The README already requires the desk folder as a root for VS Code. A window on a repo or worktree alone shows no view.
6. **Version bump.** Settled: `scripts/release.mjs` treats `vscode/package.json` as a third version file, so `bump` writes it and `bump` and `notes` refuse when the three disagree. Without this the next bump would fail `npm test`.
