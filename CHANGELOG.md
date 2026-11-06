# Changelog

agent-desk follows [Semantic Versioning](https://semver.org). One version covers the `desk` CLI and
the Claude plugin (`package.json`, `.claude-plugin/plugin.json` and `vscode/package.json` always agree). Each entry says
what an existing desk must do on upgrade; `desk check` warns while `kitVersion` in
`desk.config.json` differs from the kit installed in the desk's `node_modules`.

## Unreleased

## 0.9.0 - 2026-11-06

- Changed: `bump` and `npm test` also refuse two entries of one section that name the same todo id inside a parenthesis, right after `(` or `,`, which a rebase leaves when it rewords an entry (OpenSpec change `changelog-tid`, T-283). Nothing to do.
- Changed: `bump` refuses a `## Unreleased` section that holds a repeated entry or two entries naming one OpenSpec change, naming the duplicate and writing nothing; `npm test` fails on such a section (OpenSpec change `changelog-union`, T-99). Nothing to do.
- Changed: `desk status --watch` caches each transcript's token tally by its mtime and size, so a tick with no new transcript output reads about 27 ms instead of about 250 ms (T-262). Nothing to do.
- Fix: `desk check` decides that `claude` is missing from the spawn error or the shell's exit code (9009 for cmd; on Windows a plain 1 is settled by `where claude`), not from the English text "not recognized", so on a non-English Windows a missing `claude` skips its steps instead of failing the check (OpenSpec change `claude-probe`, T-261). Nothing to do.
- Changed: `wt discard` returns the slug's active todos to open, with no worktree and no owner; their notes stay (OpenSpec change `discard-reopens-todos`, T-278). Nothing to do.
- Fixed: `desk status` says why its screen is bare when `desk.config.json` is refused: a `Warning:` line under the heading, and a `warnings` array in `--json` (absent when there is no refusal; the schema lists it). It still exits 0 (OpenSpec change `status-config-warning`, T-277). Nothing to do.
- Changed: the README quickstart and global-install lines name the release tag (`npx github:klintravis/agent-desk#v0.8.0 init`), so a new user gets a release, not the default branch; `release.mjs bump` rewrites those pins (T-279, OpenSpec change `pin-quickstart`). Nothing to do.
- Fix: `desk todo add` without `--area` on a desk whose `desk.config.json` is refused now names the refusal in its error instead of only "add needs --area" (T-281). Nothing to do.
- Added: the Desk pane shows each status warning as an orange `Warning:` line beside its error line (OpenSpec change `pane-warnings`, T-280). Nothing to do.
- Fixed: an owner todo that was ruled with `desk decide` and later started for work no longer counts as a waiting decision. `desk status` (`decisions`, the owner count and the pane's Decisions count), `desk decide`, `desk decide --json`, the watch's `OWNER+:` lines and the Decide press now use one set (area `owner`, open or blocked, or active with no `ruled:` note), `desk decide T-n` refuses a ruled one, and the ruled active todo is listed with the work todos in `desk status`. A never-ruled owner todo that is started still waits, and a ruled one set back to open or blocked waits again (a new ruling replaces the old one; ruling T-240). OpenSpec change `owner-waiting`, spec "desk-cli" gains "A ruled owner todo is not waiting". T-236. Nothing to do.

## 0.8.0 - 2026-11-05

- Changed: features are built test-first (OpenSpec change `tdd-lite`, T-254, ruling T-249). The `implementer` commits a feature's failing test alone as `test: <behaviour>` with the body `red: <cmd> | exit <n>` (`red: n/a <why>` when there is no cheap local test, a commit hook runs the suite or a new module leaves nothing to fail on: `red: n/a new module`), then the code; `orchestrate` sets the feature approach to `test-first` and always runs the `validator`, which reruns `accept:` on the test commit (must fail on the assertion) and on the head (must pass) and checks the test-only commit comes first. `fix` is unchanged. Nothing to do.
- Added: `desk lenses <slug> [--json]` (OpenSpec change `lens-route`, T-270) prints the stack lenses a worktree's change matches, one `<lens>: <reason>` line each, from path rules on its changed files, rules on the added lines of code files and the todo's kind; the rules follow the `stack-lens` table. `orchestrate` names those lenses in briefs and, when two or more match, starts one more fresh `reviewer` per lens other than `typescript`, limited to that lens's review file, at the `review` model and effort; their findings join the one must-fix list. No new agent or task id. Nothing to do, except optionally adding `lenses` to your AGENTS.md command line.
- Changed: the redaction hook no longer swaps a placeholder back in `SubagentHandback`, a subagent's final report to its caller, as it already did not in `Agent` and `SendMessage` (OpenSpec change `redact-handback`, T-243). Nothing to do.
- BREAKING: `desk.config.json` is loaded strictly (OpenSpec change `config-strict`, T-239). An unknown key at the top level or in a `repos` entry (anything `schemas/desk-config.schema.json` does not list), an unknown key in a `tasks` entry (only `model` and `effort`), or a `tasks` / `repos` entry that is not an object, now stops the commands that load the config, with a message naming the key. Fix the typo or delete the key; `desk check` and any command show which one. `desk status` still shows no repos for such a config, without an error. The merge guard and the subagent context load leniently and ignore unknown keys (type errors still refuse them), so an older plugin copy does not fail open on a key only a newer kit knows.
- Added: the `grill` skill (OpenSpec change `grill`, T-253): `/grill T-n` interviews the owner about a todo, rounds of up to 4 questions each with a recommended answer, until the bar is met (kind set, an `accept:` note unless docs, oversized work split). Manual only (`disable-model-invocation: true`), so it adds no description to the context. Nothing to do.
- Changed: token diet for the skills (OpenSpec change `pr1-diet`, T-252). `ponytail-debt` and `ponytail-audit` set `disable-model-invocation: true`, so their descriptions leave the context and they run only as slash commands; `orchestrate`, `handoff`, `kickoff`, `decide` and `walkthrough` hold fewer copies of the repeated rules (the path of the desk command is in the session context) and lose lines that restated defaults; the review loop and the unknown-cause report format moved from `orchestrate/SKILL.md` to `skills/orchestrate/review-loop.md` (about 3.5k characters less across `orchestrate`, `handoff` and `kickoff`). `templates/agent-rules.md` lost "read big files in parts" and a repeated "Exit 0 is the verdict". `desk sync` does not rewrite an existing desk's `agent-rules.md` or `AGENTS.md`: to get the shorter rules, copy the lines from `templates/agent-rules.md` into your copy by hand. Otherwise nothing to do.
- Added: a convention for what overflows a todo's note caps: `context/T-n.md` in the desk folder, linked by the note `context: context/T-n.md`. The `handoff` skill writes it, `kickoff` reads it and `orchestrate` puts its absolute path in subagent briefs. No command, schema or pane change; `desk tidy` leaves `context/` alone; it is versioned only if the desk commits it. Nothing to do.
- BREAKING: `desk init` and `desk sync` no longer write `desk.cmd` (it is blocked on some machines); only the `desk` sh shim is written, and
  `desk sync` deletes a `desk.cmd` that carries the `written by desk sync` marker (one without it is kept, with a warning). Replace any `.\desk.cmd` in your desk's
  `AGENTS.md` / `CLAUDE.md` with the node form from `templates/AGENTS.md` (`DESK_HOME` set, `node <desk>\node_modules\agent-desk\bin\desk.mjs ...`).
- Changed: this line now carries 0.7.0 (released from the public repo), merged with the work since 0.6.0 listed below. Where the two met:
  `todo done-slug`, `board merge-ok`, `board tail`, `--self-test` and `scripts/friction-scan.mjs` stay removed (0.7.0's rules for them live on in
  `wt merge`, the merge gate and the session context); `wt merge` closes the todos started for its slug, active or blocked after they were
  started, and their open steps, while an open todo only tagged with the slug stays (0.7.0 left a started-then-blocked todo open);
  `todo note` still joins unquoted words, and a note over 1000 characters is refused, never cut, through `todo note` and `--note` alike
  (0.7.0 refused unquoted words); `--notes` is still refused rather than ignored; `desk status` takes `--cached` and `--fetch`. `desk tidy` still lists such a tagged follow-up as a finished candidate once its slug is merged,
  for the owner to close or keep. Nothing to do.
- Fixed: the Desk pane's headline counts `not pushed` branches (it showed an empty orange line when they were the only ones); a merge refused by a
  blocking verdict on the head no longer suggests posting a plain `MERGE`, which would not clear it; a stream in a `merge: "review"` repo
  returns the verifier's `PR findings:` block after a fix round, not the reviewer's stale one. Nothing to do.
- Fixed: a board line without `from`, `ts`, `kind` or `slug` shows `?` instead of `undefined` or `NaN`; `status --watch` no longer replays the board after a failed read; a re-run of CI that ends differently prints a `CI:` line; `desk overlap` sees untracked files and quoted paths. Nothing to do.

- Fixed: the spec said `desk sync` warns about a tracked `.claude/settings.local.json` on every desk, but only a desk with the `claude` harness does (the cache keys are Claude Code's; a Copilot-only desk writes none). The spec now says so, as does the one for `desk settings` (OpenSpec change `settings-warning`, specs "User cache keys in local settings" and "Settings warning for an unignored local file"), and tests assert the warning's absence on a Copilot-only desk for both commands, and its single occurrence on `desk sync` stderr. T-170. No code change; nothing to do.
- Changed: when redaction changes the answer typed under Other in the Decide dialog of the Desk pane, a toast now says the answer was masked (it was silent); the toast holds neither the typed text nor the secret, and the recorded text is masked as before. OpenSpec change `decide-scrub-toast`, spec "plugin-ui" updated. T-163. Nothing to do.

- Changed: four inputs that were accepted silently are refused (OpenSpec change `exit-codes`, specs "Board kinds and posting", "board check", "Top-level keys and defaults", "Tasks and floor keys", "Check", "Flags" of `desk-init`; ruling T-232). `desk board post` with a bad kind or slug exits 1 (it exited 0 after printing the error); the desk's own posts still never fail their caller. `desk board check` with no slug prints `usage: desk board check <slug>` and exits 1 (it printed `unclaimed`). `loadConfig` throws for a `harnesses` value that is not a non-empty array of `claude` and `copilot` (`desk sync` used to write nothing and exit 0), and for a `floor` that is not an object or has an entry that is not an object or has a key besides `model` and `effort` (it used to set no minimum). `desk init --harness` refuses any other value before writing anything, and `desk check` loads the desk's own `desk.config.json` through `loadConfig`, so it fails on what the desk refuses. **BREAKING:** a script or agent that relies on `board post` or `board check` exiting 0 after a bad call must fix the call; a desk must correct a misspelled or empty `harnesses` or a malformed `floor` in `desk.config.json` before `desk sync`, `wt`, `board check` and the other commands that read the config will run. The error names the file and key. `desk status` still shows no repos for such a config, without an error. On a `merge: "review"` desk, the local merge guard (`scripts/merge-guard.mjs`) and the subagent context (`scripts/subagent-context.mjs`) fail open on a refused config: the guard allows the command and the context drops the board and the concise-reply rule, so only the server's branch protection holds until the file is fixed. Valid files are unaffected.
- Fixed: secret redaction closes six gaps (T-234, OpenSpec change `redact-gaps2`, spec `secret-redaction`). Now hidden, and refused by `desk decide` and the `desk wt merge` PR body: a value beside `DB_PASS=` or `--pass=`, under the bar of `password=` (marks and words with a digit count); a key-shaped value beside `PASS=`, `PGPASS=` or `dbPass:`, which stay key names; a value after `--password`, `--passwd`, `--pwd` or `--pass` and a space or tab; a URL password after a user holding `@`; and every later password of a multi-host URL. A vendor key as a URL password now gets one placeholder, which restores whole in a tool call, not a placeholder inside a placeholder. A URL whose password is exactly one placeholder stays as it is and is no longer refused, so a PR body can quote a masked URL. `--password-file`, `--password-stdin`, `bypass=`, `compass:`, `pass=true` and `all tests pass: <sha>` are not touched. Still raw, each with a `shortcut:` comment: `-p <value>`, `-p<value>` and single-dash `-password <value>`; a joined spelling such as `mysqlpass`; `user pass: <value>`; a password of digits and then `,`, `?` or `#` after a user holding `@`, which reads as a port; a later host's password after a host with a user and no password, after more than 64 hosts or after a host of more than 260 characters; a later password holding both `,` and `:`, hidden only after its last comma; a password of 1 or 2 characters, and every later password after it; a value holding marks beside `PASS=`, `PGPASS=` or `dbPass:`. On upgrade: nothing to run. Text that passed before can now be refused: `pass: <40 hex>`, unless a letter and one space or tab come right before it (`all tests pass: <sha>` passes; `CI: pass: <sha>`, `209 pass: <sha>` and `tests  pass: <sha>` do not); `tests pass=<key-shaped value>`; a multi-host URL with a later host's port and an `@` in its query; put such text in other words.

- Fixed: a CLI audit (OpenSpec change `cli-audit4`, specs "Append-only JSONL files", "Board kinds and posting", "Repo entries", "Flags", "Never overwrite", "Floor and order", "User layer on the status screen"). `desk board post --repo x claim foo` read `--repo` as the kind; it is now accepted anywhere. A `null` line in `board.jsonl`, a todo note with no `ts` and a numeric todo id no longer make `desk board`, `desk todo list` or `desk todo add` exit 1 (readers keep only objects, `fold` skips a non-string id). `desk init` now refuses a repeated `--repo` id and `--harness` with no value before writing anything, reads a `package.json` with a byte-order mark, and, when it keeps an existing `.gitignore`, warns which of its lines are missing (it still never edits the file). `desk status` lists "floor raised" only for values the user settings file set. T-233. Nothing to do; add the lines `init` warns about to an older desk's `.gitignore`.

- Fixed: secret redaction hides more real secrets. Now hidden, and refused by `desk decide` and the `desk wt merge` PR body: a key's name with a suffix such as `_BASE`, `_PROD` or `_V2`, after `_`, `.` or `-` (`SECRET_KEY_BASE=`, `DB_PASSWORD_PROD=`, `db.password.prod=`), `Authorization: token <value>`, a password holding `#`, `$`, `!` or `@`, a bearer token holding `.` or `~`, a hex token as a URL's username, and a connection-string password holding `@` (`scheme://app:p@ssw0rd@db` was raw, `app:abc@defgh@db` half hidden), or following a user of 81 to 200 characters. Object keys in a tool's data are now scrubbed like values, and a placeholder in one is swapped back in a tool's input. `postgres://app:${PASS}@h:5432?x=a` still passes. OpenSpec change `redact-followups`, spec "secret-redaction" updated. T-193, T-194. No action on upgrade.

- Fixed: `desk wt finish` no longer exits 1 with no CI line when the single `gh run list` call that reads the result after the watch fails (a network blip). It is tried up to 3 times, 3 seconds apart; if all fail, the error names the commit and the `gh` error and says CI's result is unknown (a missing `gh` still fails at once). OpenSpec change `finish-result-retry`, spec "wt finish" updated. T-231. Nothing to do.

- Changed: working in a clone of this repo now enables the `plugin-dev` plugin and turns skill shell execution off (`.claude/settings.json`), so inline shell lines in skills and slash commands loaded there do not run. Desk users are not affected: the npm package does not ship this file. T-224. Nothing to do.

- Changed: the warm-hold 4-hour cap now counts from the last request of the main session instead of from when the hold began, so a session you are working in keeps its hold. Pings are not main requests: a hold kept up by pings alone still stops after 4 hours. T-226 (ruling T-216). Nothing to do.
- Fixed: `desk wt finish` no longer exits 1 when one `gh run list` call fails (a network blip) while it waits for the first CI run after a push; a failed call counts as "no run yet" and the wait goes on to the 5-minute deadline. If the last call still failed at the deadline, the error names the `gh` error (a missing `gh` still fails at once); otherwise it stays `no CI run found for <sha> after 5 minutes`. OpenSpec change `finish-gh-blip`, spec "wt finish" updated. T-223. Nothing to do.
- Fixed: in `desk status`, with nothing kept for a kind (CI runs, pull requests, review-row pull requests), one repo whose `gh` call failed made that kind unavailable for every repo and wrote null to `status-gh.json`. A failing repo now affects only its own rows; a kind is null only when every call failed and nothing is kept, and a failed read never replaces a kept answer. The README and the `desk-cli` spec say so. T-204. Nothing to do.
- Changed: `desk todo add`, `set`, `start` and `split` refuse a flag that is not a field of the todo schema (`todo set T-1 --sumary x` stored a junk `sumary` field), and `set` and `start` a word after the todo id. `desk todo done`, `drop`, `block`, `open` and `note` refuse what they used to ignore: exit 1, a message naming it, nothing written. `done`, `drop`, `block` and `open` take only `--why` and `--note` and one todo id (`todo done T-1 T-2` closed T-1 and ignored `T-2` without a word); `note` takes no flag, only the id and the text words. **BREAKING:** a script or agent that passes another flag or extra words to these commands, or a flag the schema lacks to `add`, `set`, `start` or `split`, now fails; remove them. The shipped skills and agents use none.

- Fixed: `npm run typecheck` passes again (type-only edits in `hooks/quota.ts`, `hooks/quota.test.ts`, `hooks/warmhold.ts`; no behaviour change, so no OpenSpec change). It stays out of CI: it needs the engine-written, gitignored `.claude-plugin/types`. T-220. Nothing to do.
- Changed: `desk wt finish` waits up to 5 minutes (was 60 seconds) for GitHub to register the CI run after a push, then fails with "no CI run found for <sha> after 5 minutes". Seen once: the run showed queued soon after the 60-second give-up. OpenSpec change `finish-ci-wait`, spec "wt finish" updated. T-219. Nothing to do.

- Fixed: a byte-order mark on line 1 of `todo.jsonl`, `board.jsonl` or `decisions.jsonl` hid that record from every `desk` command (the reader used plain `JSON.parse`); it now strips the mark like `desk.config.json` does. `desk check` already tolerated it. No spec requirement changes, so no OpenSpec change. T-218. Nothing to do.
- Fixed: a stream in a `merge: "review"` repo now asks for the reviewer's PR findings in its final message, so the desk manager can save them for `desk wt merge <slug> --findings <file>` (the brief said nothing, and the merge failed with no file). `scripts/gh-review-live.mjs` refuses unless its own folder holds `.git`; a plain install would otherwise run git in the repo above `node_modules`. T-217. Nothing to do.

- Fixed: the merge guard's "if main is a file, write git checkout -- main" hint shows only after a lone `git checkout <word>` that moves off the current branch. It no longer shows after `git switch main`, `git checkout -b main` or `git switch -c main`, nor when already on that branch; the verdict is unchanged. The session-context spec says nothing about the hint, so no spec change. New test: a byte-order mark in `desk.config.json` still flags a merge-setting flip in `desk check`. T-215. Nothing to do.
- Fixed: the edit guard also runs on the PowerShell tool. It now refuses `sed -E -i`, `for ...; do sed -i`, an indented `sed -i`, `(sed -i ...)`, `py -c` and `node --eval` edits, and it judges each command segment, so `python -c "print(1)" && git commit -m "rewrite x"` and other quoted mentions are no longer refused. With the plugin, nothing to do. If you wired `scripts/edit-guard.mjs` into settings by hand, change its matcher from `Bash` to `Bash|PowerShell`.

- Fixed: two timer faults in the Claude plugin. Warm-hold sent a second ping when the first was still running at the next one-minute check, and each extra ping re-reads the whole context; it now sends none while one runs (a failed ping frees the next check). The plan quota kept 240 one-minute samples, under 4 hours, so the 7-day burn rate (8.4 hours of samples) was never computed and the tail read "nothing hits 100% before reset" without it; samples are now kept at least window/240 apart (one reading a minute gives 2-minute samples for 5h and about 42-minute ones for 7d), so the 7-day rate appears after 8.4 hours of use (samples stored by an older version thin as new readings arrive). Until then the forecast covers the 5-hour window only: `collecting burn rate` shows only until the first window has a rate, and `nothing hits 100% before reset` does not speak for the week. The pane also shows `warm-hold: pinging` while a slow ping runs. T-210. Nothing to do.

- Fixed: agent briefs and scripts. The `verifier` checks CI with `gh run list -R <owner/name> --commit <HEAD sha>` (all workflows) instead of the branch's newest run, which could be an older commit; green is `success` or `skipped`, as the merge gate has it, and `gh` joins its Bash list. The `reviewer` returns the PR findings in its reply, after the verdict (its verdict line with `by <model>/<effort>` no longer lands under the "PR findings" heading), and the desk session writes the scratch file (it has no write tool). `scripts/release.mjs` and `scripts/gh-review-live.mjs` run when started through a junction or symlink (`node node_modules/agent-desk/scripts/release.mjs publish v0.7.0` printed nothing and exited 0), and `gh-review-live.mjs` runs git and gh in its own repo, not the caller's folder. The "am I the started script?" guard of `desk`, `docs-check`, `release` and `gh-review-live` is now one `isMain` helper in `lib/config.mjs`. Run `desk sync` to copy the changed `verifier` and `reviewer` to Copilot's `.github/agents/`; the Claude plugin needs nothing. T-212.

- Changed: `npm test` and `desk check` remove their temp folders after the run. Nothing to do.
- Fixed: `desk todo` loses less input. `todo add one two three` and `todo note T-1 a b c` keep every word (only the first was kept), `todo done T-1 --note "x"` keeps the note, an empty note and `todo set T-1 words` (no field) exit 1 and write nothing, and text over its cap (title 160, summary 60, why 1000, other 300) is still cut but now warns on stderr. `todo start` on a todo another session owns still takes it over and now names the previous owner on stderr. `desk init --repo me=.` writes `.` instead of an absolute path. Still dropped until T-214 is ruled: extra words on `done`, `drop`, `block` and `open`, and flags a command does not use; `todo done T-1 --why a --note b` keeps both. An empty title, an empty `split` child title and `todo set T-1 --note ""` exit 1. Changed: `deskFileWarnings(home)` lost its unused `kit` and `max` parameters. T-209.

- Fixed: the auto-compaction prune keeps snapshot output whole in two more forms: `git -C <path> status` or `stash list`, and any snapshot command run through the PowerShell tool. Before, those results were cut. Nothing to do.

- Fixed: the merge guard follows a `git checkout` or `git switch` earlier on the line. `git checkout main && git merge agent/x && git push` from an agent branch moved `origin/main` and is now refused, like `git push origin main`. A switch only adds a refusal, so a later bare push on a line with `git checkout main; git checkout agent/x` is refused too, and a lone `git checkout <file>` before a bare push now needs `--`. Nothing to do.
- Fixed: a byte order mark in `desk.config.json` no longer stops the config loading, which turned the merge guard off for every command. Nothing to do.
- Fixed: when a `gh` call fails during `desk status`, the repo it was for keeps its previous CI runs and pull requests in `status-gh.json` (including the rows under merge "review"), where they were overwritten with empty ones until the next good run. A repo whose call succeeds still replaces its answer, even with an empty one; each repo is judged on its own. Nothing to do.

- Fixed: small CLI faults. `desk status` asked GitHub for pull requests with `-F`, which turns a repo name like `org/2048` into a number and failed the query; it now uses `-f`. The `desk` and `desk.cmd` shims written by `desk sync` survive an apostrophe (sh) or a `%` (cmd) in the desk path; re-run `desk sync` to rewrite them. `desk sync` writes the JSON settings files through a temp file and a rename, so a kill mid-write no longer truncates `settings.local.json`. Wording only: "the Button's" now says "the Decide Button's" in the plugin-ui spec. No spec requirement changed, so no OpenSpec change.

- Fixed: `desk wt merge` (direct merge, with a remote) pushes the branch head to `origin/<default>` before it moves the main checkout's default branch. A rejected push used to leave the main checkout ahead of `origin`, and once `origin` moved the next merge failed on `--ff-only` until someone reset the checkout by hand. Now a failed push does not move the default branch past `origin` and says so; a re-run closes the work once the sha is on `origin`, even after `origin` moved on. Repos without a remote behave as before. Nothing to do.
- Removed (breaking): `desk --self-test` and `desk <command> --self-test` (`board`, `todo`, `tokens`, `status`, `overlap`, `decide`). `desk --self-test`, `desk board` and `desk todo` now exit 1 with the usage error, `desk decide` exits 1 ("not a waiting owner decision"), and `desk status`, `desk tokens` and `desk overlap` ignore the flag and do their normal work. The same checks run in `test/units.test.mjs`, part of `npm test` in a checkout of the repo (the package does not ship `test/`). If a script of yours calls the flag, drop the call; there is no replacement.
- Removed (breaking): `desk todo done-slug`, `desk board tail`, `desk board merge-ok` and `scripts/friction-scan.mjs`. The three commands now exit 1 with the usage error. `desk wt merge` still closes the todos of its slug and checks the verdict; the session-start context still embeds the board. If a script of yours calls any of them, stop calling it; `desk board claims` and `desk status` show the board. The recent lines and stream files now appear only in the session-start context; read `board.jsonl` for the raw lines.
- Fixed: agents no longer get `Tool result missing due to internal error` for tool results they already received after an auto-compaction prune: the prune rebuilt rows of one response's parallel calls, which split the response. It now leaves those rows whole, so a write that ran in parallel keeps its full input. Nothing to do.
- Fixed: every `desk todo` command refuses `--notes`, `--id` and `--created` (exit 1, nothing written); `--notes x` made every later `todo note` and `todo list` crash. A `todo.jsonl` that already holds such a line reads again, keeping the text as one note and not losing earlier notes; an old `id` line no longer redirects later writes. `todo split` always hangs its children under the split todo, and `todo set --parent` no longer trips over a dangling parent further up the chain. Nothing to do.
- Fixed: secret redaction missed a key beside its name when the key was hex after `Bearer`, began with a public-looking prefix, was built of words and a digit (beside `password`, `passwd` or `pwd`) or held a `/` (24+ characters mixing lowercase, uppercase and digits), and a password after an empty URL username (`redis://:pw@host`). These are now hidden, and `desk decide` and the `desk wt merge` PR body refuse them, so a Stripe publishable key or a `price_` id beside a key's name now reads as a secret too. `WebSearch` and `WebFetch` now get the placeholder, not the real value, so a URL holding a public IP, an address or a long mixed-case id fails there; use a command for it. Nothing to do.
- Fixed: `desk wt finish` says what to do when the remote branch holds commits this branch never had (an old branch of the same name): integrate them with `git rebase origin/<branch>` or delete the remote branch. `--rebased` still does not overwrite them. Nothing to do.
- Fixed: `desk tidy --apply` re-reads each todo just before clearing its dead owner, so an owner that `desk todo start` set after tidy's snapshot is kept. Nothing to do.
- Fixed: `desk tidy` lists stray worktree folders when the configured worktrees folder is itself a symlink or junction; before, it read as empty. Tidy still never deletes or moves them. Nothing to do.
- Fixed: `desk decide T-n --pick=2` (and the typed `/decide T-n --pick=2`) was recorded as the ruling text and closed the todo; it now exits 1, recording nothing, and says to write `--pick 2`. A ruling whose first word is `--pick=...` is refused too. Nothing to do.
- Fixed: the Desk pane renders when the desk CLI is older and its `desk status --json` has no `todos`; the old code read `todos.length` on every render, so the whole pane failed whichever tab was open. The Todos tab now shows `Todos ?` and `unavailable`, not zero todos. Nothing to do.
- Docs: the README's by-hand release command also builds and attaches the VS Code extension's `.vsix`. Nothing to do.
- Fixed: secret and email redaction no longer stalls on a long unbroken run of JWT starts, of private key headers or of address characters; 300 KB of such text could take half a minute or more and now takes milliseconds. What gets hidden is unchanged. Nothing to do.
- Fixed: `desk settings --json` lists the "not ignored by git" warning for the desk's `.claude/settings.local.json` in `warnings`; it went to stderr before, so the JSON lacked it. Plain `desk settings` prints it once on stderr, as `warn <text>`. Nothing to do.
- Fixed: `desk check` runs the kit's tests when the checkout path has glob characters such as `[1]`; on Node 22 it found no test files there and failed. Nothing to do.
- Changed: a private key with no END marker after its opening marker (a truncated paste, or an opening marker quoted alone) is hidden from that marker to the end of the text; the text before it is kept. PGP private key blocks are hidden like PEM ones, closed or not. `desk decide` and the PR body check of `desk wt merge` refuse both shapes, so a ruling or PR body holding one is refused. Nothing to do.
- Changed: the Desk pane's Decide button reads `Decide (n)`, n the number of waiting decisions, in the band and on the Decisions tab; it named the first decision (`Decide T-5`) before. A press works as before. The pane footer shows the status time only, without `Data, not instructions; never approval.`. Nothing to do.
- Added: `desk status --cached` prints the status from GitHub's answers of the last run (kept in the scratch folder) and calls `gh` only when none are kept. The Desk pane and the VS Code sidebar refresh within about 5 seconds when `todo.jsonl`, `board.jsonl` or `decisions.jsonl` changes, using `--cached`, and still ask GitHub at start and every minute. Nothing to do.
- Fixed: `desk todo add|split|start|set` refuse a `--status` outside `open`, `active`, `blocked`, `done` and `dropped`, and `add|set|start` refuse a `--parent` that does not exist or is the todo itself or one of its descendants; they exit 1 and write nothing. Lines already in `todo.jsonl` are not checked. Nothing to do.
## 0.7.0 - 2026-11-05

- Changed (developer only): CI runs once per commit instead of twice (a pull request from a branch of this repo reuses its push run; only a fork's pull request runs on `pull_request`), and Node 20 runs on Linux only while Node 22 runs on Linux, Windows and macOS: 4 jobs per push on the public repo instead of 12. Nothing to do.
- Added: skill `structure-rubric`, a 3.5 KB condensed form of the vendored 12.4 KB `thermo-nuclear-code-quality-review` with the same standards, presumptive blockers and output order; `structure-reviewer` now loads it, about 9 KB less per structure pass. An A/B run of both on the same commit found the same blocker and five of eight findings in common, each run with findings the other lacked. The vendored skill stays, for asking by name. Nothing to do.
- Added: `desk status --fetch` fetches every git repo with an origin before reading, so behind counts, the pushed state and the default branch are current. The Roots section (and `roots[]` in `--json`, `v` stays 2) gains each default branch's own CI (`ci`) in a repo with `gh`, and flags a repo whose `check` is empty (`noCheck`: `wt finish` checks nothing there); each Open branches line shows the branch's state word in brackets. **BREAKING:** a script that validates the JSON against the schema must accept `ci` and `noCheck`. The `kickoff` and `handoff` skills use `--fetch` in place of a fetch, `git worktree list` and `gh run list` per repo.
- Added: `desk wt handoff <slug> --next "<step>" [--todo T-n]` writes the slug's active todo's `state` from facts (head, clean or not, pushed or not, CI, the newest verdict without its `by` part) and `next`, and posts `release`; it refuses another session's claim. The `handoff` skill uses it instead of assembling the state by hand.
- Changed: `kickoff` and `handoff` no longer write `--model` on todos (the value was never used: `orchestrate` resolves model and effort from the task id at spawn); a todo carries its `--kind` instead. Nothing to do; existing `model` fields stay and still show in `todo list`.
- Fixed: a todo line with a reserved key (a stray `todo add ... --notes x`) no longer breaks every `todo` command and with it `desk wt merge` halfway through; `fold` ignores `notes`, `id`, `created` and `updated` in a line. Nothing to do.
- Fixed: `desk wt merge` (`todo done-slug`) closed every open or blocked todo tagged with the slug, follow-ups included, and left the children of a `todo split` open. It now closes the active todos of the slug and their open children that carry no other slug. Nothing to do.
- Fixed: `todo note` cut a note to 300 characters and dropped unquoted words without an error, losing the end of an `accept:` claim. A note is kept whole up to 1000 characters; a longer one, or more than one text argument, exits 1 and writes nothing. Nothing to do.
- Fixed: `desk wt new` made the branch track `origin/<default branch>`, so a bare `git push` with `push.default=upstream` landed on main; it now passes `--no-track` (`wt finish` sets the upstream on its first push). Nothing to do.
- Fixed: `desk status` showed `ready` for a branch whose head was not pushed to `origin`, which `wt merge` then refused; it shows `not pushed` (the Desk pane and the VS Code sidebar colour it like `needs review`). A second `desk stream` for a slug appends to the run log instead of wiping a live run's. Nothing to do.
- Changed: the merge gate refuses a head that any `FIXES NEEDED`, `DO NOT MERGE` or `MERGE AFTER FIXES` verdict names, whatever is posted after it, until a later `MERGE @<head> overrides: <why>`; a `DO NOT MERGE` on the head is never overridden, only a new commit clears it. Before, only the newest verdict counted, so a reviewer's `MERGE` after the validator's `FIXES NEEDED` merged. The `validator` now posts `FIXES NEEDED @<head> validation: ...` itself when a claim fails. **BREAKING:** a script or habit that cleared a `FIXES NEEDED @<sha>` by posting a plain `MERGE @<sha>` for the same commit must post `MERGE @<sha> overrides: <why>`. `desk status` reads the same rule.
- Added: `todo add|set --kind fix|feature|refactor|perf|docs` (validated, shown in `todo list`); `todo start` and `desk stream --todo` refuse a todo of a kind other than `docs` with no `accept:` note, and `desk stream` also refuses a todo that does not exist or is closed and a slug another session holds, before it starts a headless run. Untyped todos start as before. Nothing to do.
- Changed: fewer tokens per run. Each stack lens is two files (`<lens>.build.md` for the implementer, `<lens>.review.md` for the reviewer); the `validate` skill's proving steps moved to `skills/validate/proving.md` (the validator loads both; the orchestrator only the claim format); the `merge: "review"` steps moved to `skills/orchestrate/merge-review.md`; the reviewer reports in one compact format instead of also following `ponytail-review`'s Output section. The orchestrator writes each round's must-fix list to `streams/<slug>.md`. The validator's copies get the repo's `copy` paths. Nothing to do.
- Changed: the subagent context hook gives agents that write no code (`Explore`, `archiver`, `ci-triage`, `reviewer`, `scribe`, `structure-reviewer`, `validator`, `verifier`) the desk's agent rules without Ponytail, which cost them about 3 KB per spawn and asked for a closing line their fixed report formats forbid; the reviewer keeps judging leanness through `ponytail-review`. Implementers, `general-purpose` agents and sessions keep it, and so does any agent whose payload names no agent type. Nothing to do.
- Fixed: on a repo with `merge: "review"` the `reviewer` (and the `verifier` after a fix round) now ends its report with a `PR findings:` block and the orchestrator writes the file `desk wt merge --findings` reads; the reviewer was told to write that file but has no tool to write files. Nothing to do.
- Changed: each kind of docs has one owner. The implementer writes the docs that explain its change in its own commit, `scribe` writes the bookkeeping, and one `docs` run covers only what scribe hands back that the implementer did not; the `orchestrate` pipeline also places `archiver` (close-out) after them and before finish, so the review covers the archive commit. Nothing to do.
- Added: approach skills `fix` (corrections: reproduce, a failing-before test committed first, root cause fixed once in shared code; Ponytail at level full) and `refactor` (intentional restructures, deliberately aggressive: pin behaviour, plan the target shape, subtract first, script repeated edits, migrate every caller and delete the old path in one branch, prove the pinned tests pass unedited and report the net reduction; it replaces Ponytail's smallest-diff and keep-the-structure rules for that run). The `orchestrate` skill gains an Approach by kind table (fix, feature, refactor, perf, docs), the one place that picks the approach, the task id, whether the validator runs and whether the structure pass runs (once per branch, for a refactor or a change over about 300 lines outside tests or pushing a file past 1000 lines); `structure-reviewer` gains a plan mode that returns the target shape of a refactor across several files. A `debug` run now does the `fix` skill's first four steps and hands the repro, test and root cause to the implementer. Adapted from pstack's bug-fix and refactoring playbooks (MIT). Nothing to do.
- Added: skill `validate` and agent `validator` (sonnet, medium) with task id `validate`. Todos carry acceptance claims as notes, `accept: <claim> | <command> | <expected>`, written at kickoff; after `desk wt finish` the validator reruns each claim beside the reviewer, in detached copies of the head (and of the base for fix, refactor and perf), and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE; a feature whose claims CI already runs skips it. The validator posts `FIXES NEEDED @<head>` itself when a claim fails, and the merge gate refuses a head any blocking verdict names (see the merge gate entry above); the orchestrator keeps one must-fix list (reviewer findings, failed or unsettled claims, structure blockers) and posts `FIXES NEEDED` only for items no verdict on the head covers yet. The `desk stream` prompt runs the validator too and reports its `Validation:` line. The implementer runs the `accept:` commands before it reports. Adapted from Cursor's `verify-this` (MIT). Nothing to do.
- Changed: cheaper defaults in the `orchestrate` table, for lower plan usage: `fix-verify` runs on `sonnet` (was `opus`), `debug` at `medium` effort (was `high`), `review-sensitive` at `high` (was `xhigh`) and now also covers code built as `implement-hard`. The table stops at `high`; `xhigh` and `max` only when the user asks. The `verifier` agent's own model is `sonnet`. The `reviewer` reruns the repo's check only when CI for the head is not green. `review`, `implement-hard`, `propose` and `memo` stay `opus`/`high`. To keep a previous value, set it under `tasks` in `desk.config.json` (or `floor` to hold it for everyone), for example `"floor": { "review-sensitive": { "effort": "xhigh" } }`.
- Added: skill `stack-lens`, one short file per stack (`typescript`, `testing`, `state`, `perf`, `security`, `ui`), each with a build file for the `implementer` and a review file for the `reviewer`, so each role reads only its half. The `orchestrate` skill names the lenses in each brief and the agent reads only those. Adapted from Lauren Tan's pstack and Cursor's cursor-team-kit and thermos plugins (MIT). Nothing to do.
- Added: agent `structure-reviewer` (opus, medium, read-only) and the vendored skill `thermo-nuclear-code-quality-review` from Cursor's thermos plugin (MIT). It reviews structure (code-judo simplifications, spaghetti branching, files pushed past 1000 lines, wrong layer) beside the `reviewer` on changes over about 300 lines and on refactors, and posts no verdict: its blockers join the reviewer's findings for one fix round, so the merge gate is unchanged. Nothing to do.
- Added: `orchestrate` task ids `implement-perf` (sonnet, high) and `review-structure` (opus, medium); `desk settings` and the user settings file accept them. Nothing to do.
- Changed: the `implementer` names the data shape first, keeps files under 1000 lines, and removes slop from its own diff before committing. The `reviewer` loads the `security` lens for env var, port, secret, setup and feature-gate changes (devex breaks and gate leaks), reads the other side before reporting, reads a PR's threads only after its own pass, and may run read-only `gh` with `-R` and `desk todo show`; the `verifier` passes `-R` to `gh run list`. Nothing to do.

## 0.6.0 - 2026-11-03

- Added: each GitHub release carries the VS Code extension as `agent-desk-vX.Y.Z.vsix`; install it with `code --install-extension agent-desk-vX.Y.Z.vsix`. Nothing to do if you do not use it.
- Changed: the `sk-` secret shape needs a digit within 100 characters, so sentences such as `risk-based-rollout-for-every-branch` are no longer masked; a digit-free key is not caught. Nothing to do.
- Changed: the Desk pane and the VS Code extension now show the same three panels, Decisions, Work and Todos, in that order, with nothing shown twice. The pane's tabs were Work, Branches and Sessions, with decisions above them; Tokens and Roots are now rows above the tabs, and an active todo on a branch or claim shows only in Work (an open PR is said on the Pull requests card, not again on its branch row). Work lists its sections in one order in both surfaces, branches most urgent first, and the extension gains the Pull requests section. The extension's one view becomes three collapsible views. **BREAKING:** a keybinding or `when` clause on `agentDesk.status` must name `agentDesk.decisions`, `agentDesk.work` or `agentDesk.todos`. Added `todos` to `desk status --json` and its schema (`v` stays 2): open, active and blocked todos not in Work, without area `owner` and without area `idea` unless active, active first, then by priority. Printed `desk status` is unchanged. **BREAKING:** a script that validates the JSON against the schema must accept `todos`. **BREAKING:** update the desk's agent-desk together with the extension: the extension refuses a status with no `todos` and says to update whichever is older. Real differences between the surfaces are stated in `openspec/specs/plugin-ui/spec.md`, Panels in both surfaces.
- Added: owner decisions can carry real options. `desk todo add ... --option "<label>: <why>"` (repeatable, 2-4, labels up to 60 characters, recommendation first) stores `options`, with `--why` as the question's context; `desk decide --json` and `decisions[].options` in `desk status --json` (`v` stays 2) give them to readers; the Desk pane reads that JSON and shows each why in the dialog text, and the VS Code extension's Decide picker shows it as the row's detail. Choosing an option records its short label only. Typed `/decide` with no arguments now opens that same dialog when the next decision has 2 to 4 options (it only printed text before; text remains with none waiting, with other option counts, and where no dialog is possible, as in `-p`). If `/decide` is not in your slash menu, as seen in VS Code, use the new `decide` skill (plugin skills are listed namespaced, so `/agent-desk:decide`), which walks the decisions with AskUserQuestion, each why as the option's description. `desk decide T-n --pick <n>` records the nth option's label, so a label crosses no shell, and `desk decide` now refuses a ruling shaped like a secret, recording nothing. Old todos with only `--why` still display, split on `;`. The skills, `desk wt` prompts and the desk template now tell agents to write `--option`; on upgrade, update the `--why "<recommended>; <other>"` line in your desk's own `AGENTS.md` by hand, since `desk sync` does not rewrite it. **BREAKING:** a plugin or extension from this version needs a desk CLI from this version too: an older one refuses `desk decide --json` and records nothing.
- Docs: the merge guard's not-covered list (README, `hooks/mergeguard.mjs`) names PowerShell hashtable values whose key is only a `$(...)`, sits in parentheses, or has no `$` (`@{ "x" = git push origin main }`) and `GH_REPO=o/a env GH_REPO+=b gh pr merge 1`. No guard change. Nothing to do.
- Changed: `desk status --json` gives every branch a `state` word (`ready`, `needs review`, `rebase`, `fixes needed`, `CI failed`, `CI running`, `CI stale`, `no CI yet`, `CI unknown`) computed in the CLI by the rule `desk wt merge` uses, plus `verdictOld`. The Desk pane and the VS Code sidebar read it and no longer parse CI and verdict text, so a branch with a failed second CI run is no longer shown ready. In the pane, `MERGE AFTER FIXES` turns from orange to red and a `neutral` run from orange `CI unknown` to red `CI failed`. **BREAKING:** update the desk's agent-desk together with the plugin and the extension (a plugin or extension from this version on an older CLI does not work); a script that validates the JSON against the schema must accept the new fields.
- Changed: the session context, the `desk init` hint, the desk `AGENTS.md` template and the skills give PowerShell and cmd users the direct node form (`$env:DESK_HOME = '<desk>'; node '<desk>\node_modules\agent-desk\bin\desk.mjs' ...`) in place of `desk.cmd`, which some machines block; the README says so. `desk.cmd` is still written and still works. Nothing to do; an existing desk's `AGENTS.md` keeps its old text unless you copy the new lines from `templates/AGENTS.md`.
- Added: `scripts/gh-review-live.mjs` and a release step in the README: a live test of the merge `review` path's `gh` calls on a throwaway PR in the private repo (list, create, update, server merge, close proof, cleanup). Developer only; nothing to do.
- Fixed: `desk status` no longer fills a branch's PR review row (comments, unresolved threads, decision) from an open fork PR with the same branch name. Nothing to do.
- Fixed: `desk status` names `desk wt merge <slug> to close` for a merged PR only when the PR holds the branch's head (its head, or a commit on top of it); otherwise (a new commit, a reused slug) it says `PR #n merged`, and `--json` marks the `pr` with `stale: true`. Nothing to do.
- Changed: the VS Code sidebar shows one `Work` row per piece of work (todos, branch and claim joined on the slug) with a colour icon, in place of `Active todos`, `Branches` and `Claims`; it gains a `Running sessions` section with title and agent count (`unavailable` when unreadable), and empty sections are hidden.
- Fixed: the merge guard reads a push hidden by bash `$'...'` escapes (`git pu$'\x73'h origin main`) and the PowerShell assignment forms `$a += git push origin main`, `$a=$b=git push origin main` and `$a, $b = git push origin main`, and `$a –= git push origin main`, `` echo `git pu\\sh origin main` ``, `echo $$'\'; git push origin main #'`, `a[0]=x git push origin main`, `coproc git push origin main` and `GH_REPO+=o/a gh pr merge 1`. Nothing to do.
- Changed: the merge guard refuses a line it cannot read that names `push` or `merge`, or has a backslash after `$'` (a quote it reads as unterminated, as in `echo ${x:-'}'}; git push origin main`) on any desk with a `review` repo, where it allowed it before. A line it misreads but can read is judged as read, so the README's not-covered list still names such misses. Its other errors still allow. If a line you meant is refused, write the command plainly.

## 0.5.0 - 2026-11-03

- Changed: the `orchestrate` skill runs one `implementer` per code task group (in order, same worktree, each committing) for a change over about 150 lines. Nothing to do.
- Added: `desk wt rebase <slug> [--no-wait]` fetches and rebases the branch on `origin/<defaultBranch>`, pushes it like `wt finish --rebased` (check, CI wait), and runs `git range-diff` against the commit of the slug's newest board verdict, reporting whether only context changed. It posts no verdict; the merge gate is unchanged. A conflict aborts the rebase. Nothing to do on upgrade.
- Fixed: `desk tokens` and the token figures in `desk status` undercounted compacted runs: a compaction's zero-usage copy of a call overwrote its real count (42% of subagent fresh tokens over 48h on this desk). Figures rise after the upgrade. Nothing to do.
- Added: `desk tokens` shows each run's depth and parent, with two lines before the total: first-call share, cache reads per call, nested runs, and warm starts by the gap since the last spawn of an agent type and model. `--json` rows gain `depth`, `parent`, `firstFresh`, `firstRead` and `sinceSpawn`. Nothing to do.
- Fixed: `desk tokens` counted subagent calls several times over (the client's `<synthetic>` assistant lines were one call each; one reviewer showed 511 calls for 79 real ones); they are now skipped. Nothing to do.
- Changed: `npm test` discovers `test/*.test.mjs` (through `scripts/test.mjs`) instead of a file list in `package.json`. Nothing to do.
- Added: CI runs `claude plugin test` on Node 22, with a pinned Claude Code CLI installed under the job's temp folder (developer only; no API key). Nothing to do.
- Added: skill `walkthrough` walks the owner through the open `watch` todos about the Desk pane, one check at a time, and records each `pass` or `fail` on its todo. Nothing to do on upgrade.
- Added: `desk tidy` reports stray worktree folders: a folder in the worktrees folder that a configured repo's worktree
  prefix names but `git worktree list` does not. They show in a new text section and as `strayFolders` in `--json`.
  Tidy never deletes or moves them, with or without `--apply`. Nothing to do on upgrade.
- Added: per-repo `copy` in `desk.config.json`, a list of relative paths (for example `.claude-plugin/types`) that `desk wt new` copies from the repo's main checkout into the new worktree before `install` and `build`, so gitignored, machine-local files reach it. A missing path is skipped; an absolute path or one with `..` is refused. Optional; nothing to do on upgrade.

## 0.4.0 - 2026-11-02

- Added: per-repo `merge: "direct" | "review"` in `desk.config.json` (default `direct`, today's behaviour; nothing to do
  on upgrade). Under `review`, `desk wt merge <slug> --findings <file>` keeps its gates and opens or updates a pull
  request instead of merging; after a person merges on the server, re-running it closes the work. New
  `desk wt merge <slug> --into <other-slug>` merges between agent branches (both policies). New merge guard
  (`hooks/mergeguard.mjs`, `scripts/merge-guard.mjs`) refuses agent pushes and merges to protected branches;
  `desk sync` denies the edit tools on `desk.config.json`; `desk check` warns about missing server protection and a
  changed setting; `desk status` and the Desk pane show the PR state. **Only a server branch-protection rule is a
  guarantee**; the guard and the deny are best effort. The review path is tested against a `gh` stub and has not met a
  real server: try it on a throwaway pull request before relying on it.
- Changed: the Desk pane says what is working on what. Its Desk tab is now `Sessions <n>`: each session by its transcript
  title, with worktree, id and agents, the agent types without the plugin prefix (`implementer/medium`, no longer
  `agent-desk`). Open branches are one row each with one state word, most urgent first; overlaps are grouped by file,
  the top three and `+N more`; a line above the tabs counts what waits; Cache and Style share a row.
  **BREAKING:** `desk status --json` is now `v: 2`: a session gains `title` and `slug`, and `agents` changes from strings
  to `{type, about}`, so a script reading `agents` must follow. `desk tokens --json` rows gain `title`, `type` and `about`. `desk status` lists sessions the same way. Nothing else to do on upgrade.
- Added: `.gitattributes` sets `CHANGELOG.md merge=union`, so parallel branches adding entries at the same spot merge
  and rebase without a conflict (developer only). Union keeps both sides' lines, so read the result. Nothing to do on
  upgrade.
- Changed: the `orchestrate` skill and the `implementer` agent spend fewer tokens. Briefs point to todos, specs and files
  instead of pasting them; a proposal reads what its brief names and stops at about 40 tool calls; reports run about 20
  lines plus the raw verify output; the orchestrator reads the proposal and its open questions, not every artifact.
  Nothing to do on upgrade.
- Added: agent `scribe` (haiku, low effort) writes a branch's CHANGELOG entry, `openspec/inventory.md` rows and README
  command-table rows from its diff, edits nothing else and hands explanatory prose back unwritten. The `orchestrate`
  table routes those docs to it; compare its first few runs against Sonnet. `desk sync` writes it for Copilot. A desk's
  own `AGENTS.md` keeps its old agent list until edited by hand; nothing else to do on upgrade.
- Added: `desk tidy [--apply] [--json]` reports what finished work left behind. `--apply` clears the `owner` of proved-dead
  sessions, deletes proved orphan stream files and scratch logs for good, and raises one `owner` todo for todos that look
  finished, stale or forgotten; it never closes a todo. The `handoff` skill runs `--apply` and `kickoff` reads the report.
  Nothing to do on upgrade: `desk sync` copies the skills for Copilot. The first `--apply` may clear several owners and
  raise one owner todo. An existing desk keeps its `AGENTS.md`, so add `tidy` to the command list there by hand.
- Added: `scripts/docs-check.mjs [<checkout>]` compares the README (links, Node version, Commands table with its actions
  and flags) and `openspec/inventory.md` with the code; `npm test` runs it. No action on upgrade.
- Added: the read-only `ci-triage` agent (Haiku, low effort) takes a red CI run and returns the failing step, the failing
  test and the first error, and fixes nothing. The `orchestrate` skill sends CI logs to it; a long local check output
  stays with `general-purpose`. On upgrade: run `desk sync` in a desk with the `copilot` harness to get its
  `.github/agents/ci-triage.agent.md`.
- Added: per-user model, effort and cache choices in `~/.agent-desk/settings.json` (`AGENT_DESK_SETTINGS` overrides the
  path), and `desk settings [--json]` to show each resolved value and its source. `desk sync` writes user cache keys to
  git-ignored `.claude/settings.local.json` only; nothing from the file reaches a committed file, and removing a key from
  it never touches a file git tracks. `.claude/synced-permissions.json` gains `user`, the names of those keys. `desk status`
  and `desk check` show an active user layer. Nothing to do on upgrade.
- Added: `tasks` and `floor` in `desk.config.json`: a desk's values per task id, and minimums that only raise. Nothing to
  do on upgrade.
- Changed: `reviewer` and `verifier` post `<VERDICT> @<sha> by <model>/<effort>`. The merge gate reads verdicts as before,
  and `desk status --json` keeps 120 characters of a verdict, not 60. Handoff quotes verdicts in a todo without the `by`
  part. The record reaches only people who can read that desk's board. Nothing to do on upgrade.
- Changed: the `orchestrate` table's architecture memo row now says `opus` instead of "the strongest model". Set `memo` to
  `fable` in your user file if you want Fable there.
- Changed: Desk pane colour follows attention. Quota takes Context's colours, Warm's reason turns orange while off, ids
  and slugs take one accent, a todo's `next:` is no longer dim, pull request rows are statuses, the Open branches, Pull
  requests and Overlaps cards take the border of their worst status, and the Branches tab shows a red dot while one is
  red. Nothing to do on upgrade.
- Changed: the `NEXT.md` migration prints each todo it moves to `watch` and the command that moves it back, since an
  item can name a todo it only cites. Nothing to do on upgrade.
- Added: `npm run typecheck` type-checks `hooks/` and their tests (strict plus `noUncheckedIndexedAccess`) against the
  engine types (developer only). Nothing to do on upgrade.
- Added: `desk tokens --by-worktree` prints one row per worktree (calls, fresh, output, cache share); every
  `desk tokens --json` row gains a `worktree` field. Nothing to do on upgrade.
- Fixed: the `archiver` agent and the `orchestrate` skill called spec close-out post-merge; a spec change is archived
  inside its change branch, before merge. Nothing to do on upgrade.
- Fixed: `desk status --watch` printed `CTX>250k:` once per session and agent label, so a relaunched agent with the same
  label stayed silent. It is now once per agent run (its transcript file). New `ctx` board notes start with
  `[<file name>] `; older notes match nothing and make no past agent announce again (bar an old agent that drops
  below 250k and crosses again: once more). Nothing to do on upgrade.
- Fixed: the `NEXT.md` migration in `desk sync` no longer adds a duplicate `watch` todo for a "Not yet verified live" item that names one open todo (`T-n`): it moves that todo to area `watch`. An item naming a done, dropped, missing, `owner` or `idea` todo, or several ids, still adds a new `watch` todo. Nothing to do on upgrade.
- Added: an optional todo `summary` (`desk todo add|set --summary "<about 50 characters>"`, cut to 60). The Desk pane
  shows each active todo as an id row (id and summary, the title when none), then `state:` and `next:`, each cut to
  one row at the edge (the full text stays in `desk todo show`), with one label on the id row: `wt:<slug>`, else the owner (the summary is cut first; model, area, size and priority are not shown there). `desk status --json` carries `summary`. Nothing to do on upgrade; existing todos need no field.
- Fixed: `desk wt finish` no longer hangs when CI never finishes (a dead runner): it stops watching after 30 minutes
  for all runs together, reports CI `running` and exits 1. Nothing to do on upgrade.
- Fixed: a `Decide T-n` press did nothing, since the engine's command chain skips the plugin's own `/decide` hook. A
  press now asks each waiting decision in a dialog, records the answer after redaction, on one line, cut to 1000 characters, and goes on to the next. A decision with
  fewer than 2 or more than 4 options keeps the toast and the `/decide T-n ` fill. Typed `/decide` and `desk decide` do
  not change. Nothing to do on upgrade.
- Desk pane: the raw status text is gone. Owner decisions stay above three tabs (Work, Branches, Desk), every
  status field is on a tab, and CI and verdicts are coloured; green only for a result on the branch head.
  Nothing to do on upgrade.

## 0.3.0 - 2026-11-01

- agent-desk is public at `github:klintravis/agent-desk`. CI uses hosted Linux, Windows and macOS on a public repo and a self-hosted runner on a private one; the release workflow runs only on a public repo. The public history starts at this release: older versions below have no public tag. Nothing to do on upgrade, and no read access is needed to install.
- Todo area `idea` holds quick thoughts that are not work yet: `todo next` and the plain `todo list` skip them; `--area idea` and `todo list --all` show them; `todo set T-n --area <repo id>` promotes one. `todo list` now also shows an open todo whose parent it does not show (other area, or closed) at the top level. On upgrade, copy the `idea` sentence from `templates/AGENTS.md` into the desk's `AGENTS.md`; `desk sync` does not add it.
- Fixed: the band's and the pane's decide Button (now `Decide T-n`) also fills an empty prompt with `/decide T-n ` for the decision it printed, so the owner types only the ruling; before, a press only printed the question. Nothing to do on upgrade.
- Fixed: in the VS Code extension and the desktop app the Desk pane, `/desk`, `/decide` and the refresh loop now start when the editor attaches (those sessions are not interactive at start). Nothing to do on upgrade.
- The status line is `ctx <bar> % · 5h <bar> % · warm auto|off · ⚑ n` (the last two in a desk); cache and quota detail moved to the Desk pane.
- The band above the prompt shows `⚑ n decisions waiting` with a `Decide T-n` button, and a near-full context row in any session.
- The Desk pane has rows: Context, Quota, Cache, Style, Warm, Agents, Trees, Decide, above the `desk status` text.
- Keep-warm can be toggled `auto` / `off` from the pane's Warm row, for the session only.
- `desk status --json` prints the status as one object, described by `schemas/desk-status.schema.json`; the pane reads it. Nothing to do on upgrade.

- `desk sync` and `desk workspace` hide the kit's plumbing (`desk`, `desk.cmd`, `node_modules`, `package.json`,
  `.github`, `.claude`, ...) in VS Code through `files.exclude` in the desk folder's `.vscode/settings.json`.
  Your keys and any exclude you set (`false` included) stay. Nothing to do on upgrade; add `.vscode/` to an
  existing desk's `.gitignore` if you do not want to commit it (new desks get it).
- `NEXT.md` and `TODO.md` are gone. Rulings live in `decisions.jsonl` (`desk decide T-n` appends one,
  `desk decide --list [n]` prints them); what waits to be verified live is a todo with area `watch`
  (`desk todo next` skips it like `owner`); default-branch shas are on `desk status`'s Roots lines;
  `desk todo md` is removed. Every line the CLI writes carries `"v": 1`, the kit ships JSON Schemas of
  the desk files in `schemas/`, and `desk check` warns about a line that breaks one (exit code unchanged).
  **On upgrade:** run `desk sync` once. It migrates `NEXT.md` (rulings to `decisions.jsonl`, "Not yet
  verified live" to `watch` todos, the file renamed `NEXT.md.bak`; it names the sections it left there,
  such as Work), deletes a generated `TODO.md`, and patches the shipped `AGENTS.md` lines that named
  them. Edit by hand the lines it names, move anything you still need out of `NEXT.md.bak`, then commit.
  It is idempotent; a sync of named repos only does not migrate.

- `desk status --watch`: `CTX>250k:` printed again when an agent's peak fell below 250k (its transcript pruned or compacted) and crossed again.
  It now prints once ever per session and agent (a board note on slug `ctx` marks it, like `OWNER+:`).
  Nothing to do on upgrade.

- `desk status` (and the Desk pane): an open branch that lacks commits of its repo's default branch now
  says `behind <default> by N, rebase`, so a fast-forward-only `wt merge` is no surprise. It compares with
  `origin/<default>` as last fetched (no network call), or the local default branch without an origin;
  nothing is shown at 0. Nothing to do on upgrade.
- Fix: `desk init` wrote into the folder `DESK_HOME` named instead of the current folder, so running it
  from a session inside another desk changed that desk. It now always uses the current folder. Nothing to
  do on upgrade; a script that used `DESK_HOME` to aim `init` must `cd` to the new desk first.
- Fix: `desk wt discard` run from a shell inside the worktree left the folder and the board claim behind on
  Windows. `wt discard`, `wt remove` and `wt merge` now exit 1 with `cd out of <path> first` before changing
  anything; `wt discard` and `wt remove` also finish (with a warning) when git unregistered the worktree but the folder
  stayed. Nothing to do on upgrade.
- Fix: secret redaction hid template text in source as a connection-string password
  (`` `postgres://${user}:${pass}@${host}` `` reached the model with `${pass}` replaced), so the model saw
  mangled code. A password that is exactly one placeholder is now kept: `${...}` or `{{...}}` holding a
  bare name or dotted path, no default value. Any other password, including a placeholder with a default
  value (`${P:-pw}`), one that only contains `$` or a placeholder among other text, is still hidden.
  `<...>` (`<password>`, `<SuperSecret>`) is not exempted because a real password can be written in
  angle brackets; `$VAR` and `%VAR%` are not because `$ecret99` and `%ecret99%` are real passwords. Nothing to do on upgrade.

## 0.2.0 - 2026-11-01

- Fix: `desk home` exited 0 for a `DESK_HOME` folder without `desk.config.json`, so the plugin pane turned
  on outside a desk. It now exits 1. Nothing to do on upgrade; fix a stale `DESK_HOME` if the pane disappears.
- Fix: `desk wt ...` and `desk stream` ignored unknown flags and a value flag at the end of the arguments
  (`--repo` alone became `undefined`), and each accepted the other's flags (`wt discard x --dry-run` ran for
  real). Each now takes only its own flags and exits 1 with an error otherwise. On upgrade, remove typo flags from scripts.
- Fix: `desk wt finish` after a rebase or amend said only "git push failed"; it now says to rerun with
  `--rebased`. Nothing to do on upgrade.
- Fix: `desk wt merge` left the branch and the board claim behind when `git worktree remove` failed (a
  shell holding the folder on Windows). When git has already unregistered the worktree it now closes the
  merge, warns which folder to remove by hand and exits 0. When git refuses (modified or untracked files, a
  lock) it shows git's reason, keeps the worktree and the claim and exits 1. Nothing to do on upgrade.
- Release process: `node scripts/release.mjs bump <x.y.z>` sets the version in `package.json` and
  `.claude-plugin/plugin.json` and files the Unreleased entries under it; `notes <tag>` prints a
  version's entries. Pushing a tag `v*` runs `.github/workflows/release.yml`, which checks the commit is
  on `main` and creates the GitHub release. `npm test` now also checks that the two versions agree.
  Nothing to do on upgrade.
- New skill `kickoff` (start of the day, the counterpart of `handoff`): gathers the desk's live state,
  finds the work, plans the first 3-6 todos into `todo.jsonl`, shows the owner the plan and continues
  with `orchestrate` on go. `desk sync` copies it for Copilot. New desks' `AGENTS.md` mentions it;
  existing desks may add "or run the `kickoff` skill to plan the day" to theirs.
- New config key `outputStyle` (default `"Concise"`): `desk sync` writes it into every
  `.claude/settings.local.json`, so main and `desk stream` sessions run in that output style, and
  subagents get a one-line "reply concisely" rule. `""` turns it off (the next sync removes the key an earlier sync wrote).
  On upgrade run `desk sync`; set `"outputStyle": ""` to keep the old behaviour.
- Fix: `todo add --prio abc` now exits 1 with an error and writes nothing (it stored `null`), and
  `--` ends the flags so a title can start with `--` (`todo add -- "--foo"`). A flag with no value, or
  whose value starts with `--` (`--all` takes none), now also exits 1 and writes nothing. Nothing to do on upgrade.
- Docs: the kit's behaviour is now specified in `openspec/specs` (one
  capability per folder, in requirement and scenario form), with `openspec/inventory.md` listing every
  command, flag, variable, config key, hook and written file against the README section that documents
  it. The README gained a Specs section and fuller command and config reference. No config change;
  nothing to do on upgrade.
- Fix: the usage line for an unknown command now lists `home`. Nothing to do on upgrade.
- Fix: `desk stream` on Windows started claude through `cmd.exe` in a detached process, which has no
  console and exited at once with an empty log and err file. It now starts `claude.exe` directly
  (a `.cmd` shim runs undetached). A test starts a stand-in `claude` and expects output. Nothing to do on upgrade.
- `desk stream --budget <usd>` (or `budgetUsd: <usd>` in a front matter block at the top of the task
  file) passes `--max-budget-usd` to the headless claude; default none. Nothing to do on upgrade.
- `desk sync` carries the desk's own `.claude/settings.json` (permissions, env, hooks, `autoMode`,
  `enabledPlugins`, cache TTLs and any other key) into every repo checkout and worktree, so a session
  opened there gets the desk's guards and allow list. What it carried and later dropped is removed on
  the next sync. Upgrade: run `desk sync`; make the hook commands in the desk's `settings.json` absolute.
- Mod: plan quota on the status line and at the head of the Desk pane (5h and 7d use, reset
  countdown, "full in ~Xh" from the burn rate), outside a desk too. Ported from quota-meter (MIT,
  `THIRD-PARTY.md`); uninstall quota-meter to avoid two lines. Warm-hold now shares the status line.
- Mod, in a desk: cold-cache guard. A send to a cold main cache (50k+ tokens) logs the rewrite it
  causes; `AGENT_DESK_COLD_GUARD=refuse` drops the first such send instead. A cold write arms
  warm-hold for 3h with no agents running. A resumed session counts as cold until its first request;
  a turn that reads a big file is not a cold write. Ported from cache-tax (MIT); uninstall cache-tax
  to avoid a second guard and pinger.
- `desk status` (and so the Desk pane): a "Pull requests" section for open desk branches with a PR,
  in repos with `gh`: review decision, comments, unresolved threads, and feedback newer than the
  head commit. `--watch` prints `PR:` lines on a new decision or new comments. Read-only; the
  section is left out without `gh`. Ported from pr-pulse (MIT). Nothing to do on upgrade.
- Mod: a `ctx 42% · 84k/200k` meter next to the quota, with a handoff or `/compact` hint from 80%.
  After context-lens (MIT); uninstall context-lens to avoid a second line.
- Mod: secret redaction, outside a desk too. Secrets, emails and public IPs (compressed IPv6
  included) become placeholders with a random id (`2606:4700::1111`) in prompts, tool
  results, deny texts and (secrets only) the first message's context blocks, and are swapped back in
  tool input; `Agent`, `SendMessage` and `AskUserQuestion` input keeps the placeholders. The walker
  reads objects under `data` and withholds values past its depth or size limit; only the bare
  example word (up to 4 digits) is exempt from email redaction; a failing toast does not let a
  prompt through. Ported from secret-redactor (MIT) with its defaults and no options; uninstall
  secret-redactor so values are not redacted twice.
- Mod: a `cache 94%` meter after `ctx`: the cache hit (cache read / all input, as in `desk tokens`).
  After token-ledger (MIT), without its `/ledger` pane or cost; uninstall token-ledger.

## 0.1.0 - 2026-10-31

First release, extracted from a working single-repo desk.

- `desk` CLI (Node 20+, no dependencies): `status [--watch]`, `board`, `todo`, `tokens`, `overlap`,
  `decide`, `check`, and new `init`, `sync`, `workspace`, `home`.
- Each desk pins its kit: `desk init` writes the desk's `package.json` with the devDependency
  `github:klintravis/agent-desk#v0.1.0` and runs `npm install` (`--no-install` skips it). Hooks and
  settings call `<desk>/node_modules/agent-desk`; `desk sync` records its version as `kitVersion`.
  `desk init`/`sync` write a `desk` + `desk.cmd` shim into the desk folder, so `<desk>/desk` works
  from any folder without a global install.
- `desk wt new|finish|merge|remove|discard` and `desk stream`: cross-platform ports of the old
  PowerShell scripts. Merges are fast-forward only, to the exact sha the gates checked: every CI
  run on that head green (via `gh`) and a board verdict `MERGE @<head sha>`. `discard` refuses
  another session's claim without `--force`; `remove` and `discard` post `release`.
- Multi-repo: `desk.config.json` lists the repos; `--repo <id>` on slug commands; todo areas are
  repo ids, `desk` or `owner`. Entries are `kind: "git"` (worktrees) or `kind: "folder"` (a plain
  folder: workspace, readable dirs, todo area; no worktrees). `gh` is optional (no CI wait or gate);
  a clone without `origin` is local-only (no fetch or push, local ff merge). Slugs are desk-wide.
- Claude plugin: skills `handoff`, `orchestrate`, `ponytail` (+ `-review`, `-audit`, `-debt`);
  agents `implementer`, `reviewer`, `verifier`, `archiver`; mod with the Desk pane, owner-decisions
  band, `/desk`, `/decide`, prune, warm-hold and edit guard. Inert outside a desk (prune aside).
- Session and subagent context: `SessionStart`/`SubagentStart` hooks that `desk sync` writes into
  each `.claude/settings.local.json`. GitHub Copilot reads the same files, so they are the one hook
  source for both harnesses. The command carries the desk and the checkout: a worktree session
  finds the desk, and in a multi-root workspace only the checkout holding the session answers.
  Re-sync keeps the user's hooks and permissions, and drops the desk's own entries it no longer writes.
- GitHub Copilot: `desk sync` writes skills (`.github/skills/<name>/`) and agents
  (`.github/agents/<name>.agent.md`) into the desk folder's `.github/`; Copilot's hooks are the
  settings hooks above, and a `.github/hooks/agent-desk.json` from an earlier build is deleted.
- Compatible with existing files: `todo.jsonl` and `board.jsonl` read as they are; a claim without
  `repo` means the first repo; area `repo` means the first repo; any worktree prefix via
  `worktreePrefix`; `.claude/agent-rules.md` is read when the desk has no `agent-rules.md`.

Upgrade from a hand-rolled desk: run `desk init` in the desk folder (it keeps existing files), fill
`desk.config.json`, remove your own `SessionStart`/`SubagentStart` context hooks from the desk's
`.claude/settings.json` (and any checkout's settings), then `desk sync`. Both harnesses would
otherwise run the old hooks and the new ones. `init` keeps an existing `.gitignore`: if the desk
folder is a git repo, add `/desk`, `/desk.cmd`, `.claude/settings.local.json` and
`.claude/synced-permissions.json` to it yourself (they hold this machine's absolute paths).
