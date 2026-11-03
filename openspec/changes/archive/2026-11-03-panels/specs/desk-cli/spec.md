## ADDED Requirements

### Requirement: Todos in the status JSON
`desk status --json` SHALL hold `todos`: every todo with status open, active or blocked, except area `owner`, except area `idea` unless it is active, and except an active todo whose slug has an open branch or an open claim (that todo is in Work), ordered active first, then by priority, then id (a surface that shows only the first few never hides an active todo). `v` SHALL stay 2 and the printed screen SHALL not change.

#### Scenario: What is not started
- **WHEN** todos are open, blocked or in area `watch`
- **THEN** each is in `todos`

#### Scenario: Decisions and ideas
- **WHEN** a todo has area `owner`, or area `idea` and is not active
- **THEN** it is not in `todos`

#### Scenario: An active idea
- **WHEN** a todo in area `idea` is active and its slug has no open branch or claim
- **THEN** it is in `todos`

#### Scenario: A todo in Work
- **WHEN** an active todo's slug has an open branch or claim
- **THEN** it is in `active` and not in `todos`

#### Scenario: Active with nowhere to show
- **WHEN** an active todo has no slug, or its slug has no open branch or claim
- **THEN** it is in `active` and in `todos`, so it is shown once

#### Scenario: Nothing open
- **WHEN** no todo qualifies
- **THEN** `todos` is an empty list and the object still has `v` 2
