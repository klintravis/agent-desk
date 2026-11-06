## Why

The orchestrator names stack lenses in briefs by reading the change, so lenses get missed, and one
reviewer holding every lens reviews each one thinly. The owner (2026-11-06) chose auto-routed lens
specialists over new agent files: the same `reviewer` and `implementer` agents, specialised by brief.

## What Changes

- `desk lenses <slug> [--json]`: from the worktree's changed files (as `desk overlap` counts them), the
  added lines of code files and the todo's kind, print one `<lens>: <reason>` line per matched lens,
  nothing when none. Rules in `lib/lenses.mjs`, in the order and with the names of the `stack-lens` table.
- `orchestrate`: run `desk lenses` for briefs; at review, one more fresh `reviewer` per matched lens other
  than `typescript`, limited to that lens's review file, each posting its own verdict; the findings join the
  one must-fix list. One lens or none keeps one reviewer. Lens reviewers use the `review` task's model and
  effort (no new task id).
- `stack-lens`: the table is what `desk lenses` applies.

## Capabilities

### Modified Capabilities
- `desk-cli`: the `lenses` command.
- `agents`: lens routing in the review step.
