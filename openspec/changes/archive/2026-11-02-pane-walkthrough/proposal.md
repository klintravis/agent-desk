## Why

Five open `watch` todos are live Desk-pane checks only the owner can make; clearing them one by one costs a session each (T-116).

## What Changes

- A `walkthrough` skill lists the open pane-related `watch` todos from the store (no ids in the skill), asks the owner the result of each in turn, and records it on that todo with `todo note` / `todo done`.
- A skill rather than a subcommand: the work is a conversation with the owner over existing `todo` commands, so no code is added.

## Capabilities

### Modified Capabilities
- `kit-agents`: the kit also ships a `walkthrough` skill.
