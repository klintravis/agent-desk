## Why

`desk tokens` counted far too many calls for subagent transcripts: the client writes `<synthetic>` assistant lines (no `requestId`, zero usage) and each was a call of its own (T-88 reviewer: 1125 assistant lines, 432 synthetic, 79 real calls).

## What Changes

- An assistant line whose model starts with `<` is skipped. Token sums are unchanged.

## Capabilities

### Modified Capabilities
- `desk-cli`: Tokens.
