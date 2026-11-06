## Why

A stream in a `merge: "review"` repo ended without the reviewer's PR findings, so `desk wt merge --findings` had no file to read (T-217). `scripts/gh-review-live.mjs` also ran git in whatever repo held a plain install, which has no `.git` of its own.

## What Changes

- The stream brief of a `merge: "review"` repo asks for the PR findings in the final message.
- `gh-review-live.mjs` refuses unless its own folder holds `.git`.

## Capabilities

### Modified Capabilities
- `worktrees-and-streams`: requirement "Stream brief".
