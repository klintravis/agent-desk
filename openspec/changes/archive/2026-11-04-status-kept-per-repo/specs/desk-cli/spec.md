## MODIFIED Requirements

### Requirement: Status JSON
`desk status --json` SHALL print one JSON object and a newline, built from the same gathered data as the
text screen and valid against `schemas/desk-status.schema.json`. Without `--json`, `desk status` SHALL
print the text screen unchanged. `--watch` SHALL take priority over `--json`.

A `desk status` run SHALL keep its `gh` answers in `<scratchDir>/status-gh.json`. With `--cached` it SHALL use
the kept answers without calling `gh`, and read everything else fresh; when none can be read it SHALL ask `gh`
and keep the answers, as a plain run does.

When a `gh` call fails during a plain run, the repo it was for SHALL keep its CI runs, pull requests and
review-row pull requests from the kept answers (none, when nothing is kept for it), and a repo whose call
succeeds SHALL replace them with the new answer, even an empty one. Each repo is judged on its own: a failing
repo SHALL NOT make a kind unavailable for the others. A kind is unavailable (null) only when no repo has `gh`,
or every repo's call failed and nothing is kept; a failed read SHALL NOT replace a kept answer.

#### Scenario: A failing repo with nothing kept
- **WHEN** nothing is kept, and one repo's `gh` call for a kind fails while another's succeeds
- **THEN** the succeeding repo's rows of that kind are shown and kept, and the kind is not null
