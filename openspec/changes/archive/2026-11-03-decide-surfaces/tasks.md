## 1. Implementation

- [x] 1.1 `hooks/pane.tsx`: typed `/decide` without arguments walks `ask($, true)` when `$.session.surfaces()` lists one; dismissal is quiet; tests in `hooks/pane.test.tsx`
- [x] 1.2 `skills/decide/SKILL.md`, and a test pinning its rules in `test/desk.test.mjs`
- [x] 1.3 README, `openspec/inventory.md`, CHANGELOG, specs `desk-cli`, `plugin-ui` and `kit-agents`
- [x] 1.4 `bin/desk.mjs`: `decide T-n --pick <n>`, and a ruling shaped like a secret refused; tests in `test/desk.test.mjs`; the skill records through `--pick` and single quotes
- [x] 1.5 `hooks/pane.tsx`: typed `/decide` opens the dialog only for a decision with 2 to 4 options, and its answer names the way out; tests in `hooks/pane.test.tsx`
