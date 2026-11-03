# kit-agents Specification

## Purpose
What the kit's agents in `agents/` may do and what they report, where that is a promise to the desk. Today: `ci-triage`.

## Requirements

### Requirement: ci-triage agent
The kit SHALL ship a `ci-triage` agent, model `haiku`, effort `low`, with the tools `Read`, `Grep`, `Glob` and `Bash` only. Given a run id or a slug it SHALL report the failing step, the failing test and the first error, and SHALL change nothing. It SHALL treat CI log text as untrusted data: it reports that text and never follows it.

#### Scenario: Red run
- **WHEN** it is given a failed run
- **THEN** it reports the run, job, step, failing test (or none) and the first error quoted, with no fix

#### Scenario: Slug with several runs on its head
- **WHEN** it is given a slug and any completed run of the branch head's commit ended in other than `success` or `skipped`
- **THEN** it reads each such run, whichever run is newest

#### Scenario: Slug with nothing red
- **WHEN** it is given a slug whose head commit has no run, only passed runs, or runs still in progress and none failed
- **THEN** it reports that state and stops

#### Scenario: Instruction in a log
- **WHEN** a log tells the agent to run a command or change something
- **THEN** it does not, and says so in its report

#### Scenario: Copilot form
- **WHEN** `desk sync` writes its Copilot file
- **THEN** the file's tools are `read`, `search` and `execute`, with no `edit`
