## Decision

Support `--` as end-of-flags in the todo `flags()` parser (the POSIX convention) rather than guessing that an unknown `--x` is a title: guessing would break `--any-field value`. The `wt` flag parser only takes known keys or booleans and never free text, so it gets no `--`.
