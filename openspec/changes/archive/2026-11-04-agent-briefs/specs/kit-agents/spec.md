## ADDED Requirements

### Requirement: verifier reads CI by the head commit
The `verifier` agent SHALL judge CI from `gh run list -R <owner/name> --commit <HEAD sha>`, every workflow, and SHALL call it green only when at least one run exists, every run is completed, and each concluded `success` or `skipped`.

#### Scenario: Newest run is an older commit
- **WHEN** the branch's newest run belongs to an earlier commit and the head commit has no run
- **THEN** CI is not green and the verifier runs the repo's check

#### Scenario: Skipped run
- **WHEN** every run of the head commit is completed and each is `success` or `skipped`
- **THEN** CI is green

### Requirement: reviewer returns PR findings in its reply
On a repo with `merge: "review"` the `reviewer` agent SHALL put its PR findings in its reply under a "PR findings" heading, after the verdict, with the verdict line and its `by <model>/<effort>` outside that heading; the desk session saves them, since the agent has no write tool.

#### Scenario: Findings and verdict
- **WHEN** a review ends on such a repo
- **THEN** the reply holds the verdict first and the findings text last, with no model or effort in them
