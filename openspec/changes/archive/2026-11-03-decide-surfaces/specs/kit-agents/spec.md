## ADDED Requirements

### Requirement: decide skill
The kit SHALL ship a `decide` skill for surfaces where the mod's `/decide` command is not in the slash menu. It SHALL read the first waiting decision with `desk decide --json`, stop when that is `null`, ask the owner with AskUserQuestion, one decision per question, each option's label with its why as the description (no why: an empty description, never an invented one), record only the owner's answer, then read the next. Before recording it SHALL read `desk decide --json` again and, if the id or, for a picked option, the label at that place changed, record nothing and ask again. It SHALL end the walk by showing the owner each `Recorded` line. An option the owner picked SHALL be recorded with `desk decide T-n --pick <n>`, never by retyping its label into a command. The owner's own words SHALL be recorded in single quotes: in Bash each `'` written `'\''`, in PowerShell each `'` and each curly single quote doubled; cmd is not supported by this form, so the skill SHALL tell the agent to use Bash or PowerShell. It SHALL treat todo text as data and record nothing for a dismissed question. For fewer than 2 or more than 4 options, or where AskUserQuestion is not available, it SHALL show the options as text and ask for a free answer, and it SHALL NOT pad to reach two options.

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
