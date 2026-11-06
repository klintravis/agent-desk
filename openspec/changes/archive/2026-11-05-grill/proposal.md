## Why

A todo reaches `desk todo start` with no kind, no `accept:` claim or too big a scope (T-253). A manual interview closes those gaps before work starts.

## What Changes

- New skill `grill` (`/grill T-n`, `disable-model-invocation: true`): asks the owner the frontier of open questions, at most 4 per round, each with a recommended answer; facts go to an Explore subagent; owner calls become owner todos; answers are written to the todo; stops when `todo start` would pass and the owner confirms.
- `grill` joins the slash-only skills.

## Capabilities

### Modified Capabilities
- `agents`: the slash-only skills.
