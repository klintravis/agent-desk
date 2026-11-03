## Why

One `implementer` run over a whole multi-group change grows its context and cost: T-88's single run took 928 calls and 542k fresh tokens (T-114).

## What Changes

- Pipeline step 2 of the `orchestrate` skill: a change expected to pass about 150 changed lines gets one `implementer` run per code task group, in order, in the same worktree, each committing before the next starts. A single group is split first; a group that cannot pass the check alone joins its neighbour. Smaller changes keep one run: several cold starts would cost more than they save.
- No config key, no code.

## Capabilities

### Modified Capabilities
- `agents`: adds the per-task-group requirement.
