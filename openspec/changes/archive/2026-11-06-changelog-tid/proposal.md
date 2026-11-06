## Why

A rebase with `merge=union` can leave two entries for one todo when only one names an OpenSpec change, and the duplicate check missed them (T-283).

## What Changes

- `changelogGaps` also flags two entries of one section naming the same `T-<n>` right after `(` or `,`.

## Capabilities

### Modified Capabilities
- `release`: "CHANGELOG duplicate entries" gains the todo-id rule.
