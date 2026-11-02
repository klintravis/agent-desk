## MODIFIED Requirements

### Requirement: Top-level keys and defaults
The system SHALL default `harnesses` to `["claude"]`, `permissions` to `{}` and `outputStyle` to `"Concise"`, SHALL refuse an `outputStyle` that is not a string (an empty string means "do not set one"), SHALL resolve
`worktreesDir` (default `../worktrees`) and `scratchDir` (default `scratch`) against the desk folder,
and SHALL keep every other top-level key of the file (such as `kitVersion`).

#### Scenario: Minimal config
- **WHEN** the file contains only `repos`
- **THEN** harnesses is `claude`, outputStyle is `Concise`, worktrees live in `../worktrees` and scratch output in `scratch`, both relative to the desk

#### Scenario: Bad output style
- **WHEN** `outputStyle` is a number
- **THEN** loading fails naming `outputStyle`
