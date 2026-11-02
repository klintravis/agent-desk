## MODIFIED Requirements

### Requirement: Claude settings per checkout
With the `claude` harness, `desk sync` SHALL write `.claude/settings.local.json` in the desk folder and
in every git repo checkout and open worktree, or only in the checkouts named as arguments. Each file
SHALL carry `env.DESK_HOME`, the `permissions` and a non-empty `outputStyle` from `desk.config.json`, and
`SessionStart` and `SubagentStart` hooks running the pinned kit's `scripts/subagent-context.mjs` with the
event, the desk folder and the checkout. Plain folders SHALL get no file.

#### Scenario: Worktree gets its own file
- **WHEN** a worktree is open and `desk sync` runs
- **THEN** its `.claude/settings.local.json` has `DESK_HOME` set to the desk

#### Scenario: Output style
- **WHEN** `desk.config.json` has no `outputStyle`
- **THEN** every file written has `"outputStyle": "Concise"`

#### Scenario: Empty output style
- **WHEN** `outputStyle` is `""`
- **THEN** no `outputStyle` is written, and one that `desk sync` wrote earlier is removed (one it never wrote stays)

#### Scenario: Argument is not a checkout
- **WHEN** an argument has no `.git`
- **THEN** it is skipped with `skip <path>: not a git checkout` and the exit code is 1
