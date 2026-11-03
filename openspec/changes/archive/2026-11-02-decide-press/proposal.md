## Why

The `Decide T-n` Button does nothing useful on any desk (T-67). A press calls `$.command.run({ command: 'decide' })`, and the engine runs that through every hook but the calling one, so the plugin's own `/decide` hook never answers: no `desk decide` runs and nothing is filled. `hooks/pane.test.tsx` hid it by stubbing `command.run` itself. A throwaway `claude plugin test` on 2.1.314 confirmed it: a press with only the plugin's hook answering ran no `desk decide`, the same call from outside the plugin did.

The owner wants more than the old behaviour back: a press walks the waiting decisions, showing the question, the recommendation and the options, and records the ruling. The spec's `Press /decide` scenario is also still unconditional, though the requirement has conditions (T-61).

## What Changes

- A press calls the hook's body as a plain function instead of going through the engine's command chain.
- A press asks each waiting decision in the engine's own question dialog (`$.ui.ask`): question and recommendation in the text, options as the choices, free text under Other. The chosen label or the typed text is recorded verbatim with `desk decide <printed id> <ruling>`, and the next decision follows until none waits.
- A decision the dialog cannot offer (fewer than 2 or more than 4 options) gets a toast and, on an empty prompt, `/decide <printed id> `, what a press was meant to do before.
- A declined or refused dialog records nothing, fills nothing and says why in a toast. So does a failed record.
- A draft is never touched. A ruling lands on the id `desk decide` printed, never the Button's.
- The press tests drop the `command.run` stub, so only the plugin's own hook answers.
- `/decide` typed by hand and `desk decide` do not change.

## Capabilities

### Modified Capabilities
- `plugin-ui`: what a `Decide <id>` press does, with scenarios for each condition (T-61).

## Impact

`hooks/pane.tsx`, `hooks/pane.test.tsx`, `README.md`, `CHANGELOG.md`, `openspec/inventory.md`. No new command, option or dependency.
