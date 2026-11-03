## Why

`desk tokens` lists sessions and subagents, so what one change cost has to be added up by hand from agent descriptions (T-19). The transcripts already say which worktree each transcript worked for, though not in the fields that look like the answer. No new command and no stored state are needed: one flag on the existing report.

## What Changes

- `desk tokens --by-worktree` prints one row per worktree in place of one per transcript: calls, fresh, output and cache share, largest fresh first, then the usual total line. Peak context and elapsed time are left out, since neither adds up across transcripts.
- Every row of `desk tokens --json` gains a `worktree` field, with or without the flag. Grouping is then the reader's own. Existing fields do not change.
- The key is the slug, or `<repo>:<slug>` in a desk with several repos (the tag `desk overlap` uses). What belongs to no worktree is `(desk)`.
- It works from transcript text and desk config alone, so removed worktrees group like live ones.

```
$ desk tokens 720 --by-worktree
Last 720h by worktree  (fresh = uncached input; cache% = share served from cache)
worktree                   calls  fresh    out  cache%
(desk)                      1175   2.6M   359k     96%
desk-decisions               648   626k    74k     95%
session-ui                   383   605k    96k     95%
decide-press                 291   413k    53k     85%
...
total: 3843 calls, fresh 10.1M, cached 154.7M, out 1.7M
```

(Real figures from this desk's transcripts, computed by a throwaway script; 38 keys, cut here.)

## The key, and why these fields

Each transcript has one key:

- **Main session**: the worktree of its first `cwd`, else the worktree named in its first `type: user` row, else `(desk)`.
- **Subagent**: the worktree named in its first `type: user` row (its brief), else its parent session's key.

A worktree is `<worktreesDir folder>/<worktreePrefix><slug>`, matched from `desk.config.json`, ignoring case and either separator, so `C:\x\Wts\adesk-a` and `/c/x/wts/adesk-a` are the same.

Measured on this machine's transcripts: 13 main and 117 subagent transcripts of this desk, plus 47 main transcripts across its folders, a second desk's and their worktrees' for the stream counts. Fields looked at on `type: assistant` rows: `cwd`, `gitBranch`, `slug`, `sessionId`, `entrypoint`, `agentId`, `message.usage`; and on the `.meta.json` beside a subagent: `agentType`, `description`, `effort`, `model`.

| Candidate | Result | Verdict |
|---|---|---|
| Project folder of the transcript | every subagent lives under its parent's folder: 0 of 117 under a worktree's | no |
| `gitBranch` | names an `agent/*` branch for 8% of subagent tokens; 42 subagents had a worktree `cwd` and a non-agent branch: it follows the checkout the session started in | no |
| `cwd`, subagent | names a worktree for 36% of subagent tokens, and disagrees with the agent's own brief in 10 of 47 files: it is the parent's last `cd` | no |
| `cwd`, per call, main session | 87% of main-session tokens are in sessions whose `cwd` crosses several worktrees: the manager moving around, not work for them | no |
| `slug` | a session name: 0 of 5 distinct values equal a worktree slug | no |
| First `cwd`, main session | right for a session started in a worktree (5 of 5), and leaves the manager in `(desk)` | **yes** |
| Worktree in the brief, subagent | one path in 116 of 117 files (99% of tokens); agrees with the paths in the agent's tool calls in 113 of 113 | **yes** |
| Worktree in the brief, main session | a `desk stream` starts in the desk (`lib/wt.mjs`: `cwd: c.home`) and its brief names its worktree: 19 of 20; no interactive session started in a desk opened by naming one (0 of 16) | **yes** |

34 of the 37 worktrees found are already removed, which is why the live `worktreeList` plays no part. On this desk's data the split is 74% of tokens by subagent brief, 25% `(desk)` (almost all the manager's own sessions), about 1% main sessions started in a worktree.

## Not done

- **A row per OpenSpec change.** The worktree is the unit: a change lives on one branch, and the change name is not recorded anywhere a transcript reliably shows. The paths in tool calls name no change for 16 of 37 worktrees, one for 20, several for 1, and of those 20, 9 differ from the slug. Only 16 of 37 slugs equal an archived change's name. Mapping would take a stored link or a parse of tool calls for a partial answer.
- **Dollars.** It would need a price table to maintain; tokens per model are already in the rows.
- **A filter for one worktree.** `| grep <slug>`, or `--json`.
- **Changing `desk status`.** Its Tokens section stays one sum.

## Limits

- A long change needs a large `hours`: the window is still the main transcript's modified time, and a transcript in the window counts whole.
- Transcripts Claude Code has deleted are gone, so how far back a change can be costed is bounded by its cleanup.
- A main session that opens by naming a worktree goes wholly to it, even if it then does other work. None did in the data above.
- Two worktrees for one change are two rows, and a slug used twice is one row.
- The brief rule rests on the "give it the worktree path" habit of `orchestrate`: a brief that gives only a slug falls back to the parent's key. And if text injected into the first user row ever named a real worktree path, it would capture those briefs. Nothing does today (the 113 of 113 above).

## Capabilities

### Modified Capabilities
- `desk-cli`: the Tokens requirement gains `--by-worktree` and the `worktree` field.

## Impact

`bin/desk.mjs` (`tally`, `tokenRows`, `tokens`, usage comment), `test/desk.test.mjs`, README, CHANGELOG, `openspec/inventory.md`. The brief is read in memory only and never reaches any output. No dependency, config key, stored state or schema change; `desk status --json` keeps its shape.
