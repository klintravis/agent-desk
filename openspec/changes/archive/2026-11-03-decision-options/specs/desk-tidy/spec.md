## MODIFIED Requirements

### Requirement: One batched owner question
`desk tidy --apply` SHALL raise at most one owner todo for the review candidates: area `owner`, field `source` set to
`tidy`, field `tidyIds` holding the comma-separated ids, a summary, a title with the count, a `why` naming the candidates,
and `options` with the recommendation first. Tidy SHALL NOT act on the ruling. Owners and orphans SHALL NOT be part of the question.

#### Scenario: First run
- **WHEN** `desk tidy --apply` finds two candidates
- **THEN** one owner todo with `source` `tidy` names both

#### Scenario: Nothing to ask
- **WHEN** `desk tidy --apply` finds no candidates
- **THEN** no owner todo is added

#### Scenario: A ruling is not acted on
- **WHEN** the owner rules on the tidy todo and `desk tidy --apply` runs again
- **THEN** the todos it named keep their status
