# compaction-prune Specification

## Purpose

On automatic compaction the plugin first cuts re-readable tool output and keeps the conversation as
written. Implemented in `hooks/prune.ts` and the `session.compact` hook in `hooks/register.ts`. Runs
in the main session and in subagents, inside a desk or not.

## Requirements

### Requirement: Which compactions
The prune SHALL apply only to automatic compactions. A manual `/compact` SHALL go to the engine's
summary unchanged.

#### Scenario: Manual compact
- **WHEN** the trigger is not `auto`
- **THEN** the engine's own compaction runs

### Requirement: What is cut
A tool output longer than 1500 characters SHALL be cut to its first 400 characters followed by
`[pruned <n> chars; <how to get it back>]`. This SHALL apply to tool results and, for the write tools
(`Edit`, `Write`, `MultiEdit`, `NotebookEdit`), to long strings in the tool input (edit bodies). Message
text SHALL never be changed.

#### Scenario: Long file read
- **WHEN** a `Read` result has 5000 characters
- **THEN** 400 characters stay and the rest is replaced by a `[pruned 4600 chars; ...]` note

#### Scenario: Short output
- **WHEN** a result has 1200 characters
- **THEN** it is unchanged

### Requirement: What stays
The first message and the newest 8 messages SHALL be kept unchanged. Errors, results of the `Agent` and
`Task` tools, and Bash output of `git status`, `git stash list`, `gh run view` and `gh pr checks` SHALL be
kept whole.

#### Scenario: Subagent report
- **WHEN** an old `Agent` result is 6000 characters
- **THEN** it is kept whole

#### Scenario: Error output
- **WHEN** an old tool result is an error
- **THEN** it is kept whole

### Requirement: Worth it
The prune SHALL be used only when it saves at least 30% of the characters (tool uses, tool results and
text counted once). Below that, or when the prune throws, the engine's summary runs instead.

#### Scenario: Small saving
- **WHEN** the cut would save 10%
- **THEN** the summary runs and no messages are replaced

#### Scenario: Prune failure
- **WHEN** the prune throws
- **THEN** compaction continues with the engine's summary

### Requirement: Reported figures
In the main session the plugin SHALL report the context tokens before and the estimated tokens after
(before reduced by the saving) when the usage is available, and SHALL toast the saving.

#### Scenario: Usage unavailable
- **WHEN** `session.usage()` fails
- **THEN** the pruned messages are still returned, without token figures
