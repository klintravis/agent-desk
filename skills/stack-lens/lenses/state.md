# State and concurrency lens

## Build

- Name the data shape before the logic. Lifecycles are a state machine or a tagged union, not a second
  boolean that must stay in sync with the first. Branching spread over files becomes a table, a map or
  one dispatcher.
- Every state-changing step answers: what if it runs twice, and what if the last run died halfway? Read
  the current state, compare it with the goal, apply only the difference.
- Anything a run leaves behind (a lock, a temp file, a claimed job) must be recognisable as stale by the
  next run. Write to a temp path and rename into place.
- Before two actors share a write target (a file, a key, a branch), give each its own and merge at read
  time. Only a real single-object invariant gets a lock, a single writer or compare-and-swap.
- Related updates land together (one transaction, one rename) so no reader sees half of them.
- Independent work runs in parallel when that also makes the flow simpler; don't serialize it for no reason.

## Review

A finding, with the interleaving or the crash point that breaks it: check-then-write with no lock or
atomic op; two writers on one file or key; a step that is wrong on rerun or after a crash; a partial
update a reader can see; a new boolean or mode that has to agree with an existing one; an if/else chain
that grew one more branch where a table or a union would delete the chain.
