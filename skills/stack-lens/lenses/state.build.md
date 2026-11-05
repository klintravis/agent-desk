# State and concurrency lens: build

- Lifecycles are a state machine or a tagged union, not a second boolean that must stay in sync with
  the first.
- Every state-changing step answers: what if it runs twice, and what if the last run died halfway? Read
  the current state, compare it with the goal, apply only the difference.
- Anything a run leaves behind (a lock, a temp file, a claimed job) must be recognisable as stale by the
  next run. Write to a temp path and rename into place.
- Before two actors share a write target (a file, a key, a branch), give each its own and merge at read
  time. Only a real single-object invariant gets a lock, a single writer or compare-and-swap.
- Related updates land together (one transaction, one rename) so no reader sees half of them.
- Independent work runs in parallel when that also makes the flow simpler; don't serialize it for no reason.
