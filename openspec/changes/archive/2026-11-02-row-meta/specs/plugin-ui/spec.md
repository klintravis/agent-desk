## MODIFIED Requirements

### Requirement: Active todo row
On the Work tab, each active todo SHALL take at most three rows: `<id> <summary>` (`<id> <title>` when none), then `state:` and `next:` when set, each cut at the edge and never wrapped. The id row SHALL carry one label: `wt:<slug>`, else the owner, else none. A long summary or title is cut first and the label kept; a label wider than the pane is cut too. Status, area, size, priority, change and model SHALL NOT appear on the row. Owner decisions SHALL keep their full question.

#### Scenario: Summary
- **WHEN** an active todo has a summary
- **THEN** its row reads `<id> <summary>`, not the title

#### Scenario: No summary
- **WHEN** an active todo has no summary
- **THEN** its row reads `<id> <title>`, truncated at the edge

#### Scenario: Long title
- **WHEN** the summary or title is wider than the pane and the todo has a slug
- **THEN** the head is cut at the edge (`truncate-end`) and `wt:<slug>` stays visible

#### Scenario: Owner label
- **WHEN** the todo has an owner and no slug
- **THEN** the row's label is the owner

#### Scenario: No label
- **WHEN** the todo has neither slug nor owner
- **THEN** the row shows no label

#### Scenario: Other fields
- **WHEN** the todo has a model, area, size or priority
- **THEN** none of them appears on the row
