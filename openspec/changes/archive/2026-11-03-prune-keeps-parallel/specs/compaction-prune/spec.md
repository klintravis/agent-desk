## MODIFIED Requirements

### Requirement: What stays
The first message and the newest 8 messages SHALL be kept unchanged. Errors, results of the `Agent` and
`Task` tools, and Bash output of `git status`, `git stash list`, `gh run view` and `gh pr checks` SHALL be
kept whole. An assistant row SHALL keep the engine's handle, with its input whole, when another row in the
same unbroken run of assistant rows also has tool calls: those are the parallel calls of one response, and
rebuilding one of them loses tool results that the agent already received.

#### Scenario: Subagent report
- **WHEN** an old `Agent` result is 6000 characters
- **THEN** it is kept whole

#### Scenario: Error output
- **WHEN** an old tool result is an error
- **THEN** it is kept whole

#### Scenario: Parallel calls
- **WHEN** one old response made two calls, as two assistant rows in one run, and their results are long
- **THEN** both assistant rows come back with their handles and both results are cut

#### Scenario: Parallel write
- **WHEN** an old `Write` call with a long input ran in parallel with another call
- **THEN** its input stays whole, and its row keeps its handle

#### Scenario: Write alone
- **WHEN** an old `Write` call with a long input is the only call in its run of assistant rows
- **THEN** its input is cut
