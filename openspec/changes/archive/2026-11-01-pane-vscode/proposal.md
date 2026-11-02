## Why

In the VS Code extension and the desktop app the session runs under the SDK: `session.start` has `isInteractive: false` and no surface; the editor attaches later. `startPane` returned early, so `/desk`, `/decide`, the refresh loop and the Desk pane never started there (T-53).

## What Changes

- `hooks/register.ts` hooks `session.attach` and starts the pane when a desk session gets a surface; `session.start` also starts it if an attach came first.
- `startPane` is idempotent, so a REPL session that gets a phone attached registers once and runs one clock.
- Headless (`-p`, stream) sessions have no surface: still pane-free.

## Capabilities

### Modified Capabilities
- `plugin-ui`: requirement `Desk pane`.

## Impact

`hooks/register.ts`, `hooks/pane.tsx`, `hooks/pane.test.tsx`, README, CHANGELOG. The band and status line do not use the gate (they read atoms and `ui.render`). Not breaking.
