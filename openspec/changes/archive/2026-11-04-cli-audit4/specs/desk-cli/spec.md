## MODIFIED Requirements

### Requirement: User layer on the status screen
When a user layer is active, `desk status` SHALL print one line directly under its heading, naming the user file, the tasks whose resolved model or effort is below `shared`, and values of the user file a floor raised. When none is active the screen SHALL be unchanged. A problem reading the user file SHALL NOT fail the command.

#### Scenario: Cheaper review
- **WHEN** the user file lowers `review` to `sonnet` and `medium` with no floor
- **THEN** the line names `review`, `sonnet/medium` and the shared `opus/high`
- **AND** the JSON `user` holds the same entry

#### Scenario: No user layer
- **WHEN** no user file exists
- **THEN** no such line prints and `user` is null

#### Scenario: Only invalid values
- **WHEN** the user file holds no accepted value
- **THEN** no such line prints and `user` is null
