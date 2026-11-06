## MODIFIED Requirements

### Requirement: wt discard
`wt discard <slug> [--force]` SHALL force-remove the worktree and delete the branch (`-D`), uncommitted
work included, and post `release` with the text `discarded`. It SHALL refuse, unless `--force`, when
another session holds the open claim. It SHALL return the todos started with `--slug <slug>` that are
active, or blocked with an owner, to `open`, clear their `slug`, `owner`, `state` and `next`, keep their notes, add the note `worktree <slug> discarded`
and print `reopened: T-n, ...`. An open todo merely tagged with the slug stays as it is.

#### Scenario: Foreign claim
- **WHEN** session B holds the claim and session A runs `wt discard x`
- **THEN** it fails naming B and nothing is removed

#### Scenario: A started todo
- **WHEN** `wt discard x` runs and T-1 was started with `--slug x`
- **THEN** T-1 is open with no slug and no owner, its notes kept and `worktree x discarded` added
- **AND** the output says `reopened: T-1`
