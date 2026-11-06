## MODIFIED Requirements

### Requirement: Quota samples
Readings SHALL be kept per window as `(time, percent, reset time)`, at most 240, only those inside the
window, and thinned to the window divided by 240 (while the newest sample is closer than that to the one
before it, a new reading replaces it), so 240 samples span the whole window. A changed reset time, or a percent that fell by more
than 0.5, SHALL start a new window and drop the older samples. Samples SHALL persist in the plugin store
key `quota-samples`; malformed stored rows SHALL be ignored.

#### Scenario: New window
- **WHEN** the reset time moves
- **THEN** the older samples are dropped

#### Scenario: Thinned
- **WHEN** the newest sample is less than the window divided by 240 after the sample before it, and a reading comes
- **THEN** the reading replaces the newest sample, so minute readings keep 2-minute samples for 5h and about 42-minute ones for 7d, and a week of them reaches a 7-day burn rate
