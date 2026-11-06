## Why

After an auto-compaction prune, agents got `Tool result missing due to internal error` for tool results they had already received, short ones included (T-182). The prune rebuilt assistant rows that belong to one response. A rebuilt row loses the engine's handle and gets a new message id, which splits the response, and every lost result in 375 subagent transcripts sits in such a split run.

## What Changes

- The prune no longer cuts `text` on a tool use. It repeats the result row and never reaches the model, so the cut saved nothing and cost the handle.
- A write tool's input is cut only when its row is the only one with tool calls in its unbroken run of assistant rows. Otherwise the row stays whole, with its handle.
- Tool results are cut as before.

## Capabilities

### Modified Capabilities
- `compaction-prune`: "What stays".
