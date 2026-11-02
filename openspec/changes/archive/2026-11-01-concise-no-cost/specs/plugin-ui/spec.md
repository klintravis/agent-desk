## MODIFIED Requirements

### Requirement: One status line
The plugin SHALL draw one status line of its own, the warm-hold text first, then the quota, context and
cache meters, joined by ` · `, and SHALL clear it when all are empty. The meters SHALL be read after every
main-session turn and once a minute. Meters SHALL show outside a desk too.

#### Scenario: Joined line
- **WHEN** quota and context readings exist and warm-hold is idle
- **THEN** the status line is `<quota> · <ctx>`

#### Scenario: Outside a desk
- **WHEN** the session is not in a desk
- **THEN** the meters still show, and there is no pane

## REMOVED Requirements

### Requirement: Cost and cache meter
**Reason**: cost differs by plan, so the meter no longer shows a dollar amount.
**Migration**: see `Cache meter`.

## ADDED Requirements

### Requirement: Cache meter
The cache line SHALL show `cache <n>%`, cache read over all input across the main session's turns. It SHALL show no dollar amount (cost differs by plan) and SHALL be absent before the first turn.

#### Scenario: Half from cache
- **WHEN** half the input came from cache
- **THEN** the line is `cache 50%`
