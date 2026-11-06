## ADDED Requirements

### Requirement: GitHub budget on the status screen
A plain `desk status` run SHALL reuse the kept `status-gh.json` without calling `gh` while that file is under 55 seconds old, so several instances share one round a minute. When it asks, it SHALL first read `gh api rate_limit`; when `core` or `graphql` has under 20% remaining it SHALL make no other `gh` call, use the kept answers (none when nothing is kept), and add a warning naming each low budget and its reset time as local `HH:MM`, on the screen and in `warnings`. When `rate_limit` cannot be read it SHALL ask as usual.
For open pull requests it SHALL list them with `updatedAt` each round and ask for comments, reviews and review threads only for a pull request whose `updatedAt` or review decision differs from the kept row, keeping the kept row for the others. The pull request rows it prints SHALL be the same as before.

#### Scenario: Two runs within the minute
- **WHEN** `desk status` runs, and runs again 10 seconds later
- **THEN** the second run makes no `gh` call and shows the first run's answers

#### Scenario: A pull request that did not change
- **WHEN** a round finds an open pull request with the `updatedAt` and review decision kept for it
- **THEN** only the list query runs for it, and its row is the kept one

#### Scenario: A pull request that changed
- **WHEN** a round finds an open pull request whose `updatedAt` differs from the kept row, or whose kept row has none
- **THEN** its comments, reviews and threads are asked and the row is replaced

#### Scenario: Low budget
- **WHEN** `gh api rate_limit` reports under 20% remaining for `graphql` and a round is due
- **THEN** the only `gh` call is `api rate_limit`, the kept answers show, and a `Warning:` line names `graphql` and its reset time

#### Scenario: Budget unreadable
- **WHEN** `gh api rate_limit` fails
- **THEN** the round runs as it did and no budget warning shows
