## MODIFIED Requirements

### Requirement: Stream brief
The prompt SHALL give the session its task and pipeline, and SHALL tell it to stop before `desk wt merge`.

#### Scenario: Worktree form
- **WHEN** the brief is built without `--desk`
- **THEN** it states the slug (and repo and worktree path), the task text and an optional `--todo` instruction (`desk todo start T-n --slug <slug>`)
- **AND** it gives the pipeline: create or check the worktree, delegate, `desk wt finish`, fresh `reviewer`, fixes, `verifier`

#### Scenario: Desk form
- **WHEN** `--desk` is given
- **THEN** the brief tells the session to edit the desk folder directly with no worktree or CI, post a `claim desk-<slug>`, commit each finished todo on its own and review with a fresh agent

#### Scenario: Both forms
- **WHEN** either brief is built
- **THEN** it names the handoff skill and asks for the `desk tokens 24 --session self` table in the final message

#### Scenario: Merge is not delegated
- **WHEN** a worktree stream's brief is built
- **THEN** it says to STOP before `desk wt merge`

#### Scenario: Review repo
- **WHEN** a worktree stream's repo has `merge: "review"`
- **THEN** the brief asks for the reviewer's PR findings in full in the final message, for `desk wt merge --findings`
