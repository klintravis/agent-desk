## 1. Press

- [x] 1.1 `hooks/pane.tsx`: move the `/decide` hook body into a function that the hook and the press both call; `ask()` no longer calls `$.command.run`
- [x] 1.2 `hooks/pane.tsx`: the walk: parse the printed id and options, `$.ui.ask` for 2-4 options, record, go on with the printed next decision; toast plus fill-if-empty otherwise; a rejection or failed record ends it with a toast; a press during a walk does nothing

## 2. Tests

- [x] 2.1 `hooks/pane.test.tsx`: drop the `command.run` stub from the press tests (around line 318); stub `process.run` and `tool.call` of `AskUserQuestion`, so only the plugin's own hook answers
- [x] 2.2 One test per scenario of the Decisions band requirement, band and pane both pressed
- [x] 2.3 Pin the parser to real output: the press tests' fixture text comes from `decideText`'s format, and `desk decide --self-test` holds the lines the parser reads

## 3. Docs

- [x] 3.1 `README.md` (Desk pane, the press paragraph around line 146), `CHANGELOG.md`
- [x] 3.2 `openspec/inventory.md`: the press under `/decide`

## 4. Close

- [x] 4.1 `npm test && claude plugin test && claude plugin validate .` exits 0
- [x] 4.2 Add a watch todo: a press in a live session, in the terminal and in VS Code, idle and mid-turn, with a long option
