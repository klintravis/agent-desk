These tasks follow `proposal.md` under Owner rulings.

## 1. Command

- [x] 1.1 In `bin/desk.mjs`, export `writeTodo` and add `tidy: lazy('tidy.mjs', 'tidy')` to `COMMANDS`; verify: `desk frobnicate` lists `tidy` in its usage line and `desk --self-test` prints `ok`
- [x] 1.2 Create `lib/tidy.mjs`: parse flags with `flags(argv, ['apply', 'json'])`, reject positional arguments, and compute dead and unknown owners with the 24-hour constant (stat only, from the `isDeskProject` folders under `~/.claude/projects`); verify: the Dead session cases in 2.2
- [x] 1.3 Add orphan detection in `lib/tidy.mjs` for the four exact file patterns with the four guards and the missing-worktrees-folder rule; verify: the Orphan cases in 2.3
- [x] 1.4 Add review candidates (finished, stale, watch, 14-day constant) in `lib/tidy.mjs`; verify: the Candidate cases in 2.4
- [x] 1.5 Print the text report and the `--json` object, with one line when there is nothing to tidy; verify: 2.1
- [x] 1.6 Implement `--apply`: clear owners, delete orphans (a failed delete is reported and does not stop the run), and raise the one owner todo with `source` and `tidyIds`; add a `shortcut:` comment for the two-session race; verify: 2.2 to 2.5

## 2. Tests

All in new `test/tidy.test.mjs`, added to the explicit list in the `test` script of `package.json`. Each test uses a temp desk (`test/helpers.mjs`) and spawns the CLI with `HOME` and `USERPROFILE` set to a temp folder, as `test/desk.test.mjs` does for `tokens`, so no real home or desk is touched. Ages come from `utimesSync`.

- [x] 2.1 Report: writes nothing (file hashes of `todo.jsonl`, `board.jsonl`, `streams/`, scratch before and after), one line when clean, `--json` keys, unknown flag and positional argument exit 1, all data files missing; verify: `node --test test/tidy.test.mjs`
- [x] 2.2 Dead session: 25-hour transcript cleared; 1-hour not; open claim not; subagent transcript fresh not; unknown transcript listed and not cleared; `owner` not listed; no projects folder completes with nothing dead; transcript in a non-desk project folder is unknown; run without `CLAUDE_CODE_SESSION_ID` writes `from: owner`; only `owner` and `note` change; second run appends nothing; done todo untouched; verify: `node --test test/tidy.test.mjs`
- [x] 2.3 Orphans: stream file and the three scratch files deleted; each guard alone keeps the file (worktree, open todo, under 24 hours, no history); `desk-<slug>` board line counts as history; `report.txt`, `old-run.log`, `Bad_Name-run.jsonl` and `sub/old-run.jsonl` survive and are not listed; missing worktrees folder deletes nothing; configured `scratchDir` is honoured; a failed delete is reported and the run continues (a unit test of the delete step with a remove function that throws, since a held-open file is not portable); verify: `node --test test/tidy.test.mjs`
- [x] 2.4 Candidates: merged slug with no worktree; parent with closed children; 15-day stale; open child or open claim not stale; areas `owner` and `idea` not listed; old watch listed; each listed once; statuses unchanged after `--apply`; verify: `node --test test/tidy.test.mjs`
- [x] 2.5 Owner question and board: one todo with `source` and `tidyIds`; none while one is open; none for ids already raised after it is closed; new id alone raised; `why` splits into options through `desk decide`; `board.jsonl` byte-identical after a full `--apply`; verify: `node --test test/tidy.test.mjs`

## 3. Skills and template

- [x] 3.1 `skills/handoff/SKILL.md`: add a step before the commit that runs `D tidy --apply` and relays what it did; state the exception at line 12 ("write only what you own") and at step 4; verify: `claude plugin validate .`
- [x] 3.2 `skills/kickoff/SKILL.md`: add `D tidy` (report only) to step 1, use its candidates in step 2 under blocked or stale todos, and state the exception to "other sessions' fields"; verify: `claude plugin validate .`
- [x] 3.3 `templates/AGENTS.md`: add `tidy` to the `desk ...` command list; verify: `npm test` (`desk init` tests still pass). Do not hand-edit `.github/skills` copies in any desk

## 4. Docs

- [x] 4.1 `README.md`: add a `desk tidy [--apply] [--json]` row to the Commands table and a short `### Tidy` section after `### Owner decisions` covering the report, the dead rule, the orphan guards and the owner question; verify: the README check in `openspec/inventory.md` finds each new item
- [x] 4.2 `CHANGELOG.md`: add an entry under Unreleased with the upgrade note (nothing required; `desk sync` copies the skills for Copilot; the first `--apply` may clear several owners and raise one owner todo); verify: `npm test`
- [x] 4.3 `openspec/inventory.md`: add `desk tidy` to CLI subcommands, `--apply` to Flags, `lib/tidy.mjs` to the `--json` row, and note in Files written that tidy appends to `todo.jsonl` and deletes from `streams/` and the scratch folder; verify: the README check at the end of that file

## 5. Check

- [x] 5.1 Run `npm test && claude plugin test && claude plugin validate .` from the worktree and read the exit code; verify: exit 0
- [x] 5.2 Run `check-names.mjs` from the worktree before pushing; verify: exit 0
- [x] 5.3 Run `desk tidy` (report only, no `--apply`) on a copy of a real desk's `todo.jsonl` in a temp folder and read the list for false positives; verify: every listed item is explained by the spec, and anything else goes back to the owner

## Workflow follow-up

- Archive inside the change branch with `openspec archive desk-tidy`, then add `tidy` to the Purpose paragraph of `openspec/specs/desk-cli/spec.md`, which a delta cannot change.
- After merge, add `tidy` to the command list in this desk's own `AGENTS.md`, since existing desks keep their copy of the template.
