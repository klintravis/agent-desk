## ADDED Requirements

### Requirement: Deny config edits under review
With the `claude` harness, when any repo has `merge: "review"`, `desk sync` SHALL add permission rules to `permissions.deny` in the settings files it writes, denying Claude's file-edit tools on the desk's `desk.config.json`. When no repo has it, the rules SHALL be absent.

#### Scenario: Review repo present
- **WHEN** `desk sync` runs on a desk with a `review` repo
- **THEN** each written `.claude/settings.local.json` denies the file-edit tools on that file, and the desk's own permissions are kept

#### Scenario: Switching back
- **WHEN** the last `review` repo returns to `direct` and `desk sync` runs
- **THEN** the rules are gone and the user's own rules are kept

#### Scenario: Direct desk
- **WHEN** every repo is `direct`
- **THEN** the written files are the same as before this requirement

### Requirement: Sync output under review
`desk sync` SHALL print one line per `review` repo naming the policy, the deny, and that the default branch needs protecting on the server. It SHALL print no such line for a `direct` repo.

#### Scenario: One review repo
- **WHEN** a desk has one `review` repo and one `direct` repo
- **THEN** one `merge` line is printed, for the `review` repo
