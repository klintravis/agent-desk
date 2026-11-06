## Why

The Desk pane and the VS Code extension are slow to pick up a change (T-174). Measured on the live desk (Windows, one repo with CI):

| Part of `desk status --json` | Time |
| --- | --- |
| Whole run | 3.8-4.0 s |
| Same run with no `gh` on PATH | 2.2-2.3 s, so `gh` is about 1.7 s |
| Transcript scan (`desk tokens`) | 1.9-2.1 s |
| Overlaps (git) | 0.3 s |
| Reading the jsonl files (`desk todo list`, node start included) | 0.08 s |

The run is not what sets the delay: the 60 second timer is, about 30 s on average and 64 s at worst. Polling the whole run faster is ruled out, since it would call `gh` more often.

After: a `--cached` run does the work of the no-`gh` row, estimated at about 2.3 s on the live desk (not run there, since it would write the scratch file), so a write should show in about 2.5-4.5 s in the pane (a 2 s look, then the run) and about 2.6 s in the extension (300 ms, then the run). On a copy of the desk's state, which has no transcripts to scan: plain 2.3 s, `--cached` 0.5-0.7 s.

## What Changes

- `desk status --cached` reuses `gh`'s last answers, which every plain run now keeps in `<scratchDir>/status-gh.json`. It asks `gh` only when no answer is kept. Everything local (todos, board, decisions, git, sessions) is read fresh.
- The pane stats `todo.jsonl`, `board.jsonl` and `decisions.jsonl` every 2 seconds and runs `--cached` when one changed. The extension watches the same files with a `FileSystemWatcher`, debounced 300 ms, and runs `--cached`.
- The start and the 60 second timer keep the plain run, in both surfaces: `gh` is called exactly as often and is exactly as fresh as before, however many local writes land. The timer is also the fallback when a watcher fails silently.
- A recorded ruling refreshes with `--cached`: one `gh` round fewer than before.
- The pane gets the extension's one-run-at-a-time rule (it could overlap before). A full run asked during a run wins over a cached one.

## Decisions

- **Split by trigger, not by age.** An age-limited cache either lets local writes reach `gh` more than once a minute, or makes the timer reuse its own answers. Tying `gh` to the trigger avoids the trade-off, so no owner ruling is needed.
- **The pane stats instead of using `classic.FileChanged`.** The engine has that event, fed by `watchPaths` from a SessionStart hook, but nothing here proves it fires for a mod with no settings hook or for a path outside the session's folder, and the test engine cannot show it. `$.clock.every` with `$.fs.stat` is three cheap calls, works the same on every OS, and is covered by a test. Size and mtime together: on NTFS the mtime alone missed 2 of 5 back-to-back appends.
- **The keeper is in the desk's scratch folder**: already ignored by git, already private to the desk, and `desk tidy` only looks at its own fixed suffixes there.

Not done: caching the transcript scan, the largest part left of a `--cached` run (about 2 s). It is the next lever if a few seconds is not enough.

## Capabilities

### Modified Capabilities
- `desk-cli`: "Status JSON" gains `--cached`.
- `plugin-ui`: "Desk pane refresh".
- `vscode-extension`: "Refresh".
