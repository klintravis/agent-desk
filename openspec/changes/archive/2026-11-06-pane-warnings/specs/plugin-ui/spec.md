## ADDED Requirements

### Requirement: Desk pane warnings
The Desk pane SHALL show each entry of the status JSON's `warnings` as an orange `Warning: <entry>` line, under the pane's error line. With no `warnings` it SHALL draw none.

#### Scenario: A refused config
- **WHEN** the status JSON carries `warnings: ["desk.config.json refused: x"]`
- **THEN** the pane shows an orange `Warning: desk.config.json refused: x` line
