## Why

In the Desk pane's Desk tab every running session reads `agent-desk`: the agent label is the plugin prefix, and a session has only its id. Nothing says what is working on what, and the panel is a wall of text (T-103).

## What Changes

- `desk status --json` names each session: `{session, title?, slug?, agents: [{type, about}]}`, where `title` is the transcript's title, `slug` the worktrees it claims, and an agent's `type` is `implementer/medium`, without the plugin prefix. **BREAKING:** `agents` was a list of strings, so the object's `v` goes to 2 (owner ruling, T-107); the pane is the only reader in the kit. The JSONL files keep `v: 1`.
- The `desk status` screen lists a session as `- <title or id> (<id>, wt:<slug>)` with its agents under it. The `desk tokens` label is unchanged.
- The pane's Desk tab is labelled `Sessions <n>`: a row per session with name, `this session` mark, a dim footnote and one line per agent. Roots take one dim row each.
- Open branches: one row per branch with one state word, most urgent first, a second line only when it adds something, and the claim's holder on the row. Trees lists only claims with no branch.
- Overlaps: grouped by file, the top three and `+N more`.
- A headline above the tabs counts what waits, in the colour of the worst, and is absent when nothing does.
- Cache and Style share a row.

No new settings or features.

## Capabilities

### Modified Capabilities
- `desk-cli`: the session fields of `desk status` and `desk status --json`.
- `plugin-ui`: the Desk pane's rows, tabs, sessions, branches, overlaps and headline.
