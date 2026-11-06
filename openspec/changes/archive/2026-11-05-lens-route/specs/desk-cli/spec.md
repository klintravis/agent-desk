## ADDED Requirements

### Requirement: Lenses
`desk lenses <slug> [--json]` SHALL print one line `<lens>: <reason>` for each `stack-lens` lens that the open worktree `<slug>` matches, in the table's order, and nothing when none matches; `--json` SHALL print the same as an array of `{ lens, why }`. The rules in `lib/lenses.mjs` SHALL carry the table's lens names in its order.

#### Scenario: What is matched
- **WHEN** the lenses of a worktree are computed
- **THEN** a path regex runs on every changed file (as `desk overlap` counts them), a regex on the added lines of code files (never Markdown, JSON, YAML or other prose and data files), and the kind of the open todo with that slug (`fix` brings `testing`, `perf` brings `perf`)
- **AND** the reason is the first match (`kind fix`, a path, or `<path> adds <text>`), then `(+N)` for the rest

#### Scenario: Files by path
- **WHEN** the worktree changed `lib/a.ts`, `test/x.test.mjs` and `hooks/redact.ts`
- **THEN** the lines are `typescript: lib/a.ts (+1)`, `testing: test/x.test.mjs` and `security: hooks/redact.ts`

#### Scenario: Kind fix
- **WHEN** the todo with the slug has kind `fix` and the worktree changed only `lib/a.ts`
- **THEN** the lines are `typescript: lib/a.ts` and `testing: kind fix`

#### Scenario: Added lines
- **WHEN** a commit adds `spawnSync(` to `lib/wt.mjs` and the word `secret` to a skill's `SKILL.md`
- **THEN** `security: lib/wt.mjs adds spawnSync(` is printed and the `SKILL.md` line counts for no lens

#### Scenario: No match or no worktree
- **WHEN** the worktree changed only `README.md` under a `feature` todo
- **THEN** nothing is printed and the exit code is 0
- **AND** `desk lenses nosuch` exits 1 with `desk lenses: no worktree "nosuch"`

## MODIFIED Requirements

### Requirement: Dispatch
`desk <command>` SHALL run one of `status`, `check`, `board`, `todo`, `tokens`, `overlap`, `decide`, `lenses`, `tidy`, `wt`, `stream`, `init`, `sync`, `workspace`, `settings`, or `home` (specified below).

#### Scenario: Version
- **WHEN** `desk --version` runs
- **THEN** the kit version is printed

#### Scenario: No built-in self-tests
- **WHEN** `desk --self-test` or `desk <command> --self-test` runs
- **THEN** the CLI runs no checks: `desk --self-test`, `desk board` and `desk todo` exit 1 with the usage error, `desk status`, `desk tokens` and `desk overlap` ignore the flag and do their normal work, and `desk decide` exits 1 ("not a waiting owner decision")
- **AND** the checks live in `test/units.test.mjs`

#### Scenario: Unknown command
- **WHEN** `desk frobnicate` runs
- **THEN** a usage line listing the commands is printed and the exit code is 1

#### Scenario: Error reporting
- **WHEN** a command throws `no repo "x"`
- **THEN** stderr shows `desk <command>: no repo "x"` and the exit code is 1

#### Scenario: On-demand commands
- **WHEN** `lenses`, `tidy`, `wt`, `stream`, `init`, `sync`, `workspace` or `settings` has a fault
- **THEN** it loads on demand, so `status` still works
