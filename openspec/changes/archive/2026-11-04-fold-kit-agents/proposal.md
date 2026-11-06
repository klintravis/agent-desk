## Why

`kit-agents` and `agents` both specify the kit's agents in `agents/`; one capability is enough (todo T-106).

## What Changes

- The five requirements of `kit-agents` (ci-triage, verifier, reviewer, decide, walkthrough) move into `agents` unchanged. The `kit-agents` spec folder is deleted. No code change.

## Capabilities

### Modified Capabilities
- `agents`: gains the five requirements of `kit-agents`; Purpose widened.
