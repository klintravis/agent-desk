## MODIFIED Requirements

### Requirement: Status JSON
`desk status --json` SHALL print one JSON object and a newline, built from the same gathered data as the
text screen and valid against `schemas/desk-status.schema.json`. Without `--json`, `desk status` SHALL
print the text screen unchanged. `--watch` SHALL take priority over `--json`.

A `desk status` run SHALL keep its `gh` answers in `<scratchDir>/status-gh.json`. With `--cached` it SHALL use
the kept answers without calling `gh`, and read everything else fresh; when none can be read it SHALL ask `gh`
and keep the answers, as a plain run does.

When a `gh` call fails during a plain run, the repo it was for SHALL keep its CI runs, pull requests and
review-row pull requests from the kept answers, and a repo whose call succeeds SHALL replace them with the new
answer, even an empty one. Each repo is judged on its own.

#### Scenario: Fields
- **WHEN** `desk status --json` runs
- **THEN** the object has `v` (2), `at`, `decisions`, `active`, `todos`, `claims`, `sessions`, `roots`, `branches`, `prs`, `overlaps`, `tokens`, `user` and `text`
- **AND** `sessions`, `prs`, `overlaps` and `tokens` are null when their source is unavailable or no lookup ran
- **AND** `user` is null when no user layer is active

#### Scenario: A session's fields
- **WHEN** a session in `sessions` has a transcript title and a claim
- **THEN** it has `session`, `title`, `slug` (the claims' slugs, joined with `,`) and `agents`, and a field with no value is left out
- **AND** each agent is `{type, about}`: `type` without the plugin prefix and with the effort when known (`implementer/medium`), `about` the agent's description or empty

#### Scenario: Parses and validates
- **WHEN** `desk status --json` runs in a desk
- **THEN** stdout parses as one JSON object that validates against the `desk-status` schema, and the command exits 0

#### Scenario: Same data as the text
- **WHEN** `desk status` and `desk status --json` run on the same desk state
- **THEN** the JSON `text` equals the text screen, apart from the time on the heading line
- **AND** the waiting decisions and claims in the JSON are the ones the text lists

#### Scenario: Sources down
- **WHEN** `gh` cannot be read and nothing is kept for it, and the transcripts cannot be read
- **THEN** `sessions` is null, each branch's `ci` is `CI unavailable`, and the command exits 0

#### Scenario: Verdict kept whole
- **WHEN** a branch's newest verdict carries `by <model>/<effort>`
- **THEN** its `verdict` holds the whole text, up to the 120 characters the board stores

#### Scenario: Cached run after a plain run
- **WHEN** `desk status --json` has run, a todo is added, and `desk status --cached --json` runs
- **THEN** the second run calls `gh` zero times, shows the new todo, and has the first run's branch CI and PR state

#### Scenario: Cached run with nothing kept
- **WHEN** `desk status --cached --json` runs and `status-gh.json` is missing or torn
- **THEN** it asks `gh`, shows the answers and keeps them

#### Scenario: A failed call keeps the old answer
- **WHEN** a plain `desk status` run keeps answers, and the next run's `gh` call for one repo's CI, pull requests or review-row pull requests fails
- **THEN** that repo's kept rows of that kind stay in `status-gh.json` and in the output, and a repo whose call succeeded shows its new answer

#### Scenario: An empty answer replaces
- **WHEN** a repo's `gh` call succeeds with no rows
- **THEN** that repo's kept rows of that kind are gone
