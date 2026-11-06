## MODIFIED Requirements

### Requirement: wt merge
On a repo with `merge: "direct"`, `wt merge <slug>` SHALL fast-forward the default branch to the local branch head only when every gate passes for that one sha.

#### Scenario: Merge steps
- **WHEN** all gates pass
- **THEN** with a remote, the default branch is fast-forwarded to `origin/<default>`, the sha is checked to descend from it, the sha is pushed to `origin/<default>`, and only then is the local default branch fast-forwarded to the sha (`--ff-only`); without a remote it is fast-forwarded to the sha
- **AND** a failed push does not move the default branch past `origin/<default>`, and a re-run closes the work once the sha is on `origin/<default>`, even after `origin` moved on
- **AND** `merged` is posted, every `open`, `active` or `blocked` todo started with that slug becomes `done` with the note `merged (<slug>)`, and the worktree is removed
