## ADDED Requirements

### Requirement: Merge policy key
A `git` repo entry MAY set `merge` to `direct` or `review`. It SHALL default to `direct`. The value SHALL be read only from the committed `desk.config.json`: no user-layer file or environment variable SHALL set or override it.

#### Scenario: Default
- **WHEN** a repo entry has no `merge`
- **THEN** its `merge` is `direct` and every command behaves as it did before the key existed

#### Scenario: Bad value
- **WHEN** `merge` is any other value
- **THEN** loading the config fails naming the repo and the two values

#### Scenario: Review on a folder
- **WHEN** an entry with `kind: "folder"` sets `merge: "review"`
- **THEN** loading the config fails

#### Scenario: Review with no prefix
- **WHEN** an entry sets `merge: "review"` with an empty `branchPrefix`
- **THEN** loading the config fails, because nothing would be protected

#### Scenario: Review with the default branch inside the prefix
- **WHEN** an entry sets `merge: "review"` and its `defaultBranch` starts with its `branchPrefix`
- **THEN** loading the config fails, because the default branch would count as an agent branch

#### Scenario: No gh or origin does not fail the load
- **WHEN** an entry sets `merge: "review"` and has no `gh` value or no `origin`
- **THEN** the config loads, and `wt merge` and `desk check` report it

#### Scenario: User file cannot switch the policy
- **WHEN** a user-layer settings file holds `merge` or `repos`
- **THEN** the repo's `merge` stays what `desk.config.json` says
