## MODIFIED Requirements

### Requirement: Warm-hold stops
Warm-hold SHALL stop, and say why in the Desk pane's Warm row, when holding is pointless or unsafe.

#### Scenario: Cap
- **WHEN** it has held for 4 hours with no main-session request in that time (its own pings do not count)
- **THEN** it stops with `held 240m, the cap`
- **AND** a main-session request restarts the 4 hours

#### Scenario: Already cold
- **WHEN** the cache is already 60 minutes old
- **THEN** it stops with `cache already cold, nothing to hold`

#### Scenario: Ping failed
- **WHEN** the ping fork is not answered
- **THEN** it stops with `ping failed (<reason>)`

#### Scenario: Cache gone
- **WHEN** the ping wrote to the cache at least a tenth of what it read
- **THEN** it stops with `the ping found the cache gone`

#### Scenario: A main request restarts it
- **WHEN** a main-session request refreshes the cache
- **THEN** the stop reason is cleared and counting starts again
