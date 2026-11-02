## Why

The `/decide` Button in the band and the pane only printed the next decision; the owner then had to type `/decide T-n <ruling>` by hand, so a press looked like it did nothing. The Buttons were also unstyled (`/decide`, full-width in the pane).

## What Changes

- A press runs `/decide` (the options print), then fills the prompt with `/decide <id> ` for the ruling, `<id>` the first waiting decision.
- Both Buttons read `Decide <id>`, drawn as the primary action; the band's count is yellow.

## Capabilities

### Modified Capabilities
- `plugin-ui`: requirements `Desk pane` (Decide row) and `Decisions band`.

## Impact

`hooks/pane.tsx`, `hooks/pane.test.tsx`, README, CHANGELOG. Not breaking.
