## Why

Every session pays for skill text it rarely needs: two report-only skills advertise themselves, three skills repeat the same rules, and the review loop sits in the orchestrate body. Notes also overflow the todo caps with no place to go.

## What Changes

- `ponytail-debt` and `ponytail-audit` set `disable-model-invocation: true` (slash command only).
- `orchestrate`, `handoff`, `kickoff`, `decide`, `walkthrough` keep one copy of repeated rules and point to it; no-op lines go. Orchestrate's review loop and unknown-cause text move to `skills/orchestrate/review-loop.md`.
- `templates/agent-rules.md` drops two lines. `desk sync` does not rewrite an existing desk's copy: edit it by hand.
- New convention: `context/T-n.md` in the desk folder, linked by a todo note `context: context/T-n.md`. `handoff` writes it, `kickoff` reads it, `orchestrate` gives its absolute path in briefs. No CLI, schema or pane change.

## Capabilities

### Modified Capabilities
- `agents`: report-only skills are slash-only; the orchestrate skill's review loop lives in a sibling file.
- `todos-and-board`: the context file convention.
