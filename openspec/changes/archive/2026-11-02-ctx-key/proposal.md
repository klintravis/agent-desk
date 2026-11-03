## Why

`desk status --watch` announces `CTX>250k:` once ever per session plus agent label (type/effort/first 34 characters of the description). A relaunched agent with the same label is a new agent but stays silent (T-41).

## What Changes

- The once-ever key is the agent's transcript file name (`<uuid>.jsonl`, or the subagent's `agent-<id>.jsonl`), so each agent run announces once. Token rows carry it as `file`.
- The `ctx` note starts with `[<file name>] `; a restarted watch finds its marker by that prefix (first, because `post()` cuts notes at 120 characters and a long label would cut a trailing marker). The printed `CTX>250k:` line is unchanged (readable label, no file name). Only the file name goes on the board, never a path, so no username or home folder leaks.
- Old notes (`<session> <agent> over 250k (announced)`, no leading file name) are ignored by the new check and never crash it. They do not make past agents announce again: a line needs a live crossing from 250k or less to above it, and an agent already above 250k when the watch starts does not cross. Only an old agent that drops below 250k (pruned, compacted) and crosses again announces once more, with the new note.
- Rows are matched between looks by file too, so a relaunched agent with the same label is a new agent (`AGENT+:`).

## Capabilities

### Modified Capabilities
- `desk-cli`: the CTX alert marker in Status watch.
