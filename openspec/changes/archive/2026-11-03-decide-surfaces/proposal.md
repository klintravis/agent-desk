## Why

`/decide` works badly outside the Desk pane's Button: it is a command the mod registers with `$.command.register`, and it
does not appear in VS Code's slash menu (seen live by the owner). Typed with no arguments it only prints text; only the
Button opens the picker.

## What Changes

- Typed `/decide` with no arguments walks the same dialog as the Button, with the same `walking` guard, when the next
  decision has 2 to 4 options, and its answer names the way out if no dialog opens. With arguments
  (`T-n <ruling>`, `--list [n]`) nothing changes. With none waiting, other option counts, or no surface listed by
  `$.session.surfaces()` (a `-p` run) it returns the printed text as before. The owner closing the dialog records nothing
  and toasts nothing.
- A real skill `skills/decide/SKILL.md`, for surfaces where the mod's command is not in the slash menu. It reads
  `desk decide --json`, asks with AskUserQuestion (label, and the why as the option's description), records a picked option
  with `desk decide T-n --pick <n>` and the owner's own words in single quotes, and goes on. The Copilot sync copies it with
  the other skills; where AskUserQuestion is not available it prints the options and asks for a free answer.
- `desk decide T-n --pick <n>` records the nth option's label, so a label from a todo crosses no shell. Pasted into a
  command, a label could run as one.
- `desk decide` refuses a ruling shaped like a secret, recording nothing: text typed in the skill's Other passes no
  redaction on the way to `decisions.jsonl`.
- Docs: README, inventory, CHANGELOG (the existing options entry), specs `desk-cli`, `plugin-ui`, `kit-agents`, `todos-and-board` and `secret-redaction`.

Not breaking.

## Findings and risks

- `$.ui.ask` takes labels only (`AskOptions`: `options`, `header`, `multiSelect`), no per-option description, so the mod's
  dialog keeps the whys in the question text. The skill's AskUserQuestion does carry a description per option.
- `$.ui.ask` rejects both when dismissed and in a `-p` run. The two cannot be told apart from the rejection, so the typed
  path asks `$.session.surfaces()` first (empty in `-p`, never rejects) and treats a rejection after that as dismissal.
- Name clash, not testable here: the types say a plugin's skill and a `$.command.register` command are both `plugin`
  commands (`CommandSource`) and say nothing of two sharing a name; registering "a built-in's name is refused" is the only
  rule stated. Plugin skills are listed namespaced (`agent-desk:walkthrough`), so the skill is probably `/agent-desk:decide`
  and bare `/decide` stays the mod's. Unknown until tried live: what the terminal menu shows for both, and whether a typed
  `/decide` picks one. Both stay named `decide`; if they collide, rename the skill.
- Unknown until tried live: whether `$.ui.ask` opens from a typed command (it is started without awaiting, so the turn does not wait on the dialog).

## Capabilities

### Modified Capabilities

- `desk-cli`: `desk decide T-n --pick <n>`, and the refusal of a ruling shaped like a secret.
- `plugin-ui`: typed `/decide` walks the dialog.
- `kit-agents`: the `decide` skill.
- `todos-and-board`: a flag's value that reads like a flag is refused after cleaning, not only when `--` is its first character.
- `secret-redaction`: a bare `sk-` run counts as a key only when a digit falls within 100 characters of the prefix.

## Impact

`bin/desk.mjs`, `hooks/pane.tsx`, `hooks/pane.test.tsx`, `skills/decide/SKILL.md`, `test/desk.test.mjs`, README, inventory, CHANGELOG. No new dependency.
