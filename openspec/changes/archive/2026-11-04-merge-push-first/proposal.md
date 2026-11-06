## Why

`wt merge` fast-forwarded the main checkout's default branch before pushing. A failed push left it ahead of `origin`; once `origin` moved, `merge --ff-only origin/<default>` refused and the desk stayed stuck until the checkout was reset by hand (T-201).

## What Changes

- With a remote, `wt merge` checks the sha descends from the default branch, pushes `<sha>:refs/heads/<default>`, and only then fast-forwards the local branch. A failed push does not move the default branch past `origin`. A rerun closes the work once the sha is on `origin`, even after `origin` moved on.
- Without a remote, nothing changes.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: the "Merge steps" scenario of "wt merge".
