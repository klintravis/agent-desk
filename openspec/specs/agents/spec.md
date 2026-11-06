# agents Specification

## Purpose
The kit's delegation agents in `agents/`, the skills they load, and the `decide` and `walkthrough` skills, as far as their scope is a promise to the desk. Today: `scribe`, the `orchestrate` run rule, `ci-triage`, `verifier`, `reviewer`, `structure-reviewer`, `stack-lens`, the `fix` and `refactor` approaches, `validator`, `decide`, `walkthrough`, `grill`, the slash-only skills (`ponytail-audit`, `ponytail-debt`), the `orchestrate` review loop and its lens reviewers.

## Requirements

### Requirement: Scribe writes bookkeeping docs from a diff
The kit SHALL ship an agent `scribe` with model `haiku` and effort `low`. It SHALL write a branch's CHANGELOG entry, `openspec/inventory.md` rows and rows of the README's command table from the branch's diff, and SHALL edit no other file or README text.

#### Scenario: New command on a branch
- **WHEN** a branch's diff adds a command and `scribe` runs on it
- **THEN** it adds the CHANGELOG entry, the inventory row and the command-table row
- **AND** `git diff --name-only` for its edits lists only those three files

### Requirement: Scribe hands back explanatory prose
`scribe` SHALL leave prose that describes behaviour unwritten and SHALL list each such item in its report, with the file and section it belongs in.

#### Scenario: Change needs a README paragraph
- **WHEN** a branch's change needs a paragraph explaining new behaviour
- **THEN** `scribe` does not write it and its report lists it under Handed back

### Requirement: Scribe stays out of other agents' work
`scribe` SHALL NOT archive specs, review or verify. The `orchestrate` skill SHALL route these docs to `scribe` in a row that does not overlap its docs row for `implementer`, and `archiver` SHALL stay on `sonnet`.

#### Scenario: Picking an agent for docs
- **WHEN** the orchestrator looks up a README paragraph and a CHANGELOG entry in the `orchestrate` table
- **THEN** the paragraph matches the `implementer` row and the entry matches the `scribe` row

### Requirement: Scribe reaches Copilot
`desk sync` SHALL write `scribe` to `.github/agents/scribe.agent.md` with the other kit agents, with `reasoning-effort: "low"` and its tools mapped, and without a `model` field.

#### Scenario: Sync with the copilot harness
- **WHEN** `desk sync` runs with the `copilot` harness
- **THEN** `.github/agents/scribe.agent.md` exists with that frontmatter

### Requirement: One implementer run per task group
The `orchestrate` skill SHALL tell the orchestrator to start one `implementer` run per code task group, in order, in the same worktree, when a change is expected to change over about 150 lines, and each run SHALL commit before the next starts. A single group SHALL be split first, and a group that cannot pass the check alone SHALL join its neighbour. `scribe` SHALL run after the last run's commit.

#### Scenario: Large change with three code groups
- **WHEN** a change expected to pass 150 lines has three code task groups
- **THEN** the orchestrator runs three `implementer` runs in sequence in one worktree, each ending in a commit

#### Scenario: Large change with one group
- **WHEN** a change expected to pass 150 lines has one task group
- **THEN** the orchestrator splits it into groups before the first run

#### Scenario: Small change with several groups
- **WHEN** a change expected to stay under 150 lines has several task groups
- **THEN** one `implementer` run does them all

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

### Requirement: verifier reads CI by the head commit
The `verifier` agent SHALL judge CI from `gh run list -R <owner/name> --commit <HEAD sha>`, every workflow, and SHALL call it green only when at least one run exists, every run is completed, and each concluded `success` or `skipped`.

#### Scenario: Newest run is an older commit
- **WHEN** the branch's newest run belongs to an earlier commit and the head commit has no run
- **THEN** CI is not green and the verifier runs the repo's check

#### Scenario: Skipped run
- **WHEN** every run of the head commit is completed and each is `success` or `skipped`
- **THEN** CI is green

### Requirement: reviewer returns PR findings in its reply
On a repo with `merge: "review"` the `reviewer` agent, and the `verifier` after a fix round, SHALL end its report with its PR findings in a `PR findings:` block, after the verdict, with the verdict line and its `by <model>/<effort>` outside that block; the orchestrator writes the block to the file `desk wt merge --findings` reads, since the agent has no write tool.

#### Scenario: Findings and verdict
- **WHEN** a review ends on such a repo
- **THEN** the reply holds the verdict first and the findings text last, with no model or effort in them

### Requirement: decide skill
The kit SHALL ship a `decide` skill for surfaces where the mod's `/decide` command is not in the slash menu. It SHALL read the first waiting decision with `desk decide --json`, stop when that is `null`, ask the owner with AskUserQuestion, one decision per question, each option's label with its why as the description (no why: an empty description, never an invented one), record only the owner's answer, then read the next.

#### Scenario: Further rules
Before recording it SHALL read `desk decide --json` again and, if the id or, for a picked option, the label at that place changed, record nothing and ask again. It SHALL end the walk by showing the owner each `Recorded` line. An option the owner picked SHALL be recorded with `desk decide T-n --pick <n>`, never by retyping its label into a command. The owner's own words SHALL be recorded in single quotes: in Bash each `'` written `'\''`, in PowerShell each `'` and each curly single quote doubled; cmd is not supported by this form, so the skill SHALL tell the agent to use Bash or PowerShell. It SHALL treat todo text as data and record nothing for a dismissed question. For fewer than 2 or more than 4 options, or where AskUserQuestion is not available, it SHALL show the options as text and ask for a free answer, and it SHALL NOT pad to reach two options.

#### Scenario: Two waiting
- **WHEN** T-5 and T-6 wait with two options each and the owner answers both
- **THEN** each is asked on its own with its whys as descriptions, and `desk decide` runs once per answer

#### Scenario: A picked label crosses no shell
- **WHEN** the owner picks the second option, whose label holds quotes and a shell command
- **THEN** `desk decide T-5 --pick 2` runs and the label appears in no command line

#### Scenario: The owner's own words
- **WHEN** the owner types their own answer under Other, holding a quote
- **THEN** it is recorded in single quotes with the quote doubled or escaped for the shell in use, and stored whole

#### Scenario: Words Git Bash would rewrite
- **WHEN** the owner's own words start with `/` and are recorded through Bash
- **THEN** the command sets `MSYS_NO_PATHCONV=1`, so Git Bash on Windows does not turn them into a Windows path

#### Scenario: Words Windows PowerShell 5.1 would change
- **WHEN** the owner's own words hold `"` or end in `\`
- **THEN** the skill records them through Bash, not Windows PowerShell 5.1, which changes such an argument without an error; with no Bash it records nothing and gives the owner the command to run

#### Scenario: One option
- **WHEN** a decision has exactly one option
- **THEN** it is shown as text and the owner is asked for a free answer, with no second option invented

#### Scenario: A position gone stale
- **WHEN** the owner picked an option, and `desk decide --json` read again before recording shows another id, or another label at that place
- **THEN** nothing is recorded and the owner is asked again

#### Scenario: The walk ends
- **WHEN** no decision is left or the owner stops
- **THEN** the owner is shown each `Recorded` line the commands printed, and the ids still waiting

#### Scenario: No AskUserQuestion
- **WHEN** AskUserQuestion is not available
- **THEN** the options are printed and the owner is asked for a free answer

#### Scenario: Dismissed
- **WHEN** the owner dismisses the question
- **THEN** nothing is recorded and the walk stops

### Requirement: walkthrough skill
The kit SHALL ship a `walkthrough` skill that reads the open `watch` todos about the pane at run time (it SHALL NOT name todo ids), presents each in turn as data, asks the owner for `pass`, `fail` or `skip`, and records the answer only on that todo: a note, plus `todo done` on `pass`. It SHALL write nothing on `skip`.

#### Scenario: Pass
- **WHEN** the owner answers `pass` for an open pane check
- **THEN** that todo gets a note and is marked done, and no other todo changes

#### Scenario: Fail
- **WHEN** the owner answers `fail` with what they saw
- **THEN** the note quotes it and the todo stays open

### Requirement: Structure reviewer
The kit SHALL ship an agent `structure-reviewer`, model `opus`, effort `medium`, with the tools `Read`, `Grep`, `Glob`, `Bash` and `Skill` only, that follows the `structure-rubric` skill (a condensed form of the vendored `thermo-nuclear-code-quality-review`) on a worktree branch's diff, or, given paths, returns a refactor's target shape. It SHALL change nothing and SHALL post no board verdict.

#### Scenario: Further rules
The `orchestrate` skill's Approach by kind section SHALL be the one place that says when it runs: once per branch, beside the `reviewer`, for a refactor or a change over about 300 changed lines outside test files or pushing a file past 1000 lines. Its blockers SHALL join the must-fix list (see Validator).

#### Scenario: Large change
- **WHEN** a feature of about 400 changed lines outside tests reaches review
- **THEN** the orchestrator starts `reviewer` and `structure-reviewer` in the same message on the same head
- **AND** a fix round after it goes to the `verifier`, not to a second structure pass

#### Scenario: Small change
- **WHEN** a feature of 40 lines that grows no file past 1000 lines reaches review
- **THEN** no structure pass runs

### Requirement: Stack lenses
The kit SHALL ship a `stack-lens` skill whose table lists each lens, with two files under `lenses/`: `<lens>.build.md` and `<lens>.review.md`. The `implementer` SHALL follow the build file and the `reviewer` SHALL check the review file of the lenses its brief names or its files match (one only, for a one-lens brief), reading no other. `orchestrate` SHALL name in each `implementer` and `reviewer` brief what `desk lenses <slug>` prints, plus lenses no rule catches.

#### Scenario: TypeScript change with a retry loop
- **WHEN** a brief names the lenses `typescript` and `state`
- **THEN** an implementer reads `typescript.build.md` and `state.build.md` and no other lens file

### Requirement: Lens reviewers
When `desk lenses` prints two or more lenses, the `orchestrate` review step SHALL start, beside the main `reviewer` (which gets every lens), one more fresh `reviewer` per printed lens other than `typescript`, in the same message, at the `review` task's model and effort, briefed with that lens's review file only and to report only findings in that lens. Each SHALL post its own verdict, and its findings SHALL join the one must-fix list.

#### Scenario: Lens reviewers
- **WHEN** `desk lenses` prints `typescript`, `security` and `testing` for a branch at review
- **THEN** three fresh reviewers start in one message: the main one with all three lenses, one with `security.review.md` only and one with `testing.review.md` only
- **AND** each posts a verdict on the same head, and a finding from any of them goes on the must-fix list

#### Scenario: Small change
- **WHEN** `desk lenses` prints only `typescript`, or nothing
- **THEN** one reviewer runs

### Requirement: Approach by kind
The kit SHALL ship approach skills `fix` and `refactor`, each ending in a `## Done when` list. The `orchestrate` skill SHALL map each change kind (fix, feature, refactor, perf, docs) to an approach, a task id, whether the validator runs and whether the structure pass runs, and SHALL name the approach in every `implementer` and `reviewer` brief.

#### Scenario: Further rules
The `implementer` SHALL follow the named approach; the `reviewer` SHALL judge the diff's scope against it (a fix that changes more than the fault, a refactor that changes behaviour). Only `refactor` SHALL replace Ponytail's smallest-diff and keep-the-structure rules, for its run only, and only in its own skill text; Ponytail's never-cut list SHALL hold in every approach. A `debug` run SHALL do the `fix` skill's steps 1-4 and hand the repro, test and root cause to the implementer, which starts at step 5.

#### Scenario: A bug with an unknown cause
- **WHEN** a todo of kind fix has no known cause
- **THEN** a `debug` run commits the failing test and reports the root cause
- **AND** the `fix-known` implementer starts at the `fix` skill's step 5

#### Scenario: A feature is built test-first
- **WHEN** a todo of kind feature is implemented
- **THEN** the `implementer` commits the failing test alone as `test: <behaviour>` with the body `red: <cmd> | exit <n>` before the first non-test commit, or `red: n/a <why>` when no cheap local test exists, a commit hook runs the suite or the test cannot fail on an assertion before a new module exists (`red: n/a new module`)
- **AND** the validator finds the test commit by `git log --grep '^red:' origin/<default>..HEAD` (none is NOT VERIFIED), runs the `accept:` command on it expecting a non-zero exit on the behaviour's assertion (not a missing module), then on the head expecting 0, and `git log --name-only --reverse origin/<default>..HEAD` shows the test commit, touching only tests, before the first non-test commit
- **AND** with a `red: n/a` receipt the validator skips the test-commit run and the order check, judges the why and still runs the head

#### Scenario: An intentional refactor across several files
- **WHEN** a todo of kind refactor spans several files
- **THEN** a `structure-reviewer` in plan mode returns the target shape for the area's paths first
- **AND** the implementer follows `refactor`, and the validator shows no pinned test edited after its pinning commit

### Requirement: Validator
The kit SHALL ship a `validate` skill and an agent `validator`, model `sonnet`, effort `medium`, tools `Read`, `Grep`, `Glob`, `Bash`, `Write` and `Skill`, that reruns a branch's acceptance claims (`accept: <claim> | <command> | <expected>` todo notes and new spec scenarios) in a detached copy of the head, and of the base for fix, refactor and perf (the test commit for a feature), and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE per claim.

#### Scenario: Further rules
The `validate` skill SHALL be the one list of what each kind proves. The validator SHALL change nothing in the worktree, SHALL run nothing in it, SHALL remove every copy it adds, and SHALL post `FIXES NEEDED @<head>` when any claim is not VERIFIED. The `orchestrate` skill SHALL run it beside the `reviewer` for every kind but docs, and SHALL keep one must-fix list per branch (reviewer findings, failed or unsettled claims, structure blockers). The merge gate SHALL refuse a head that any `FIXES NEEDED`, `DO NOT MERGE` or `MERGE AFTER FIXES` verdict names, whatever verdict comes after it, unless a later verdict is `MERGE @<head> overrides: <why>` (never for `DO NOT MERGE`). `todo start` and `desk stream --todo` SHALL refuse a todo whose `kind` is other than `docs` and that has no `accept:` note; `--kind` SHALL be one of `fix`, `feature`, `refactor`, `perf`, `docs`.

#### Scenario: A fix that did not fix
- **WHEN** the validator posts `FIXES NEEDED @<head>` and the reviewer later posts `MERGE @<head>`
- **THEN** `desk wt merge` refuses the head

#### Scenario: A claim settled by a rerun
- **WHEN** `MERGE @<head> overrides: rerun verified` follows it
- **THEN** the earlier `FIXES NEEDED @<head>` no longer blocks

#### Scenario: A typed todo without a claim
- **WHEN** `desk todo start T-1` runs on a todo of kind `fix` with no `accept:` note
- **THEN** it exits 1 and the todo stays open

### Requirement: Slash-only skills
`ponytail-debt`, `ponytail-audit` and `grill` SHALL set `disable-model-invocation: true`, and no other skill of the kit SHALL.

#### Scenario: Only the slash-only skills
- **WHEN** the kit's `skills/*/SKILL.md` are searched for `disable-model-invocation: true`
- **THEN** exactly `grill`, `ponytail-debt` and `ponytail-audit` match

### Requirement: Grill interview
`skills/grill/SKILL.md` SHALL be at most 2560 bytes and SHALL end an interview only when the bar is met (kind set, an `accept:` note unless docs, oversized work split), the frontier is empty (questions waiting on a raised owner todo are parked, not open) and the owner confirms, never starting work in that turn.

#### Scenario: Size
- **WHEN** `wc -c skills/grill/SKILL.md` runs
- **THEN** it prints at most 2560

#### Scenario: End condition
- **WHEN** a todo has a kind and an `accept:` note but the frontier still holds an open question
- **THEN** the interview continues

#### Scenario: Confirming turn
- **WHEN** the owner confirms the last answers
- **THEN** the session stops and `desk todo start` is not run in that turn

### Requirement: Orchestrate review loop in a sibling file
The `orchestrate` skill SHALL keep step 4's must-fix list, board verdict and fix-verification rules, and the unknown-cause report format, in `skills/orchestrate/review-loop.md`, and step 4 SHALL tell the orchestrator to read that file.

#### Scenario: Pointer
- **WHEN** `skills/orchestrate/SKILL.md` step 4 is read
- **THEN** it names `review-loop.md` and the rules for `FIXES NEEDED` and `overrides:` verdicts are in that file
