## Why

The CHANGELOG entry, inventory rows and README command-table rows of a branch follow from its diff, yet they go to a Sonnet `implementer` with the rest of the docs. A cheaper agent can do them if it cannot drift into prose that makes claims about behaviour (T-95).

## What Changes

- New kit agent `scribe` (haiku, low effort): writes those three things from a branch's diff and edits nothing else. Explanatory prose goes back unwritten, listed in its report. It never archives specs, reviews or verifies.
- The `orchestrate` table gains a `scribe` row, and its docs row narrows so the two do not overlap. `archiver` stays on sonnet.
- The docs say to compare its first few runs against Sonnet. That comparison is not part of this change.
- `desk sync` writes the agent for Copilot like any other kit agent; the picker's model applies there.

## Capabilities

### New Capabilities
- `agents`: the kit's delegation agents; starts with `scribe`.
