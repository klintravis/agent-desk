# agent-desk

One desk for parallel coding-agent sessions over many repos and folders. A desk is a plain folder
next to your repos. It holds the shared state every session reads at start:

- **todos** (`todo.jsonl`)
- **a claim board** (`board.jsonl`): who holds which worktree, CI results, review verdicts
- **rulings** (`decisions.jsonl`): the owner's decisions, appended by `desk decide`

Every change happens in its own git worktree. Merges go through a gate: CI green and a review
verdict `MERGE @<head sha>` on the board. The same skills, agents and session context are set up
for **Claude Code** and **GitHub Copilot** from one source.

It ships in two parts that share one version number:

- **`desk` CLI**: Node 20+, no dependencies. Covers status, todos, the board, worktrees, streams,
  init and sync. `desk sync` also writes the session and subagent context hook (Ponytail, the desk
  rules, the board), which Claude Code and Copilot both read.
- **Claude Code plugin**:
  - skills: `kickoff`, `handoff`, `orchestrate`, `decide`, `walkthrough`, `fix`, `refactor`, `validate`, `stack-lens`, `structure-rubric`, `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `thermo-nuclear-code-quality-review`
  - agents: `implementer`, `reviewer`, `structure-reviewer`, `validator`, `verifier`, `archiver`, `scribe`, `ci-triage`
  - a mod: the Desk pane, the owner-decisions band, `/desk` and `/decide`, auto-compaction prune,
    cache warm-hold, the edit guard and the session meters (plan quota, context), secret redaction

## Install

**Requirements.**

- Node 20 or later and `git`.
- `gh`, logged in (`gh auth login`), for the CI wait, the merge gate, PR state in `desk status` and
  any repo with `gh` set.
- The `claude` CLI for `desk stream`, `desk check` (plugin tests) and the plugin.

**CLI.** Each desk pins its own kit, the way husky or commitlint are pinned: `desk init` writes the
desk's `package.json` with the devDependency `"agent-desk": "github:klintravis/agent-desk#v<version>"`
and runs `npm install` (`--no-install` skips it). `npx` is only for that first init:

```sh
mkdir desk && cd desk
npx github:klintravis/agent-desk init --repo app=../app
./desk status            # from then on: the desk's shim (PowerShell and cmd: the node form below)
```

`desk init` and `desk sync` write a `desk` shim (and `desk.cmd` for Windows) into the desk folder. The
shim runs the desk's pinned kit with `DESK_HOME` set, so `<desk>/desk ...` works from any folder,
worktrees included. Agents are told its path in their session context.

On a machine that blocks `desk.cmd`, run the kit directly with node (it selects the desk from any folder,
worktrees included, because `DESK_HOME` wins over the current folder), or use `./desk` in Git Bash:

```powershell
$env:DESK_HOME = 'C:\path\to\desk'; node 'C:\path\to\desk\node_modules\agent-desk\bin\desk.mjs' status
```

```bat
set "DESK_HOME=C:\path\to\desk" && node "C:\path\to\desk\node_modules\agent-desk\bin\desk.mjs" status
```

Either form leaves `DESK_HOME` set in that terminal, and it wins over the current folder; `Remove-Item Env:DESK_HOME` or `set DESK_HOME=` clears it.

This still needs `node` and the kit's scripts to be allowed to run; what is allowed is the machine
administrator's decision. Agents get the exact command for their desk in the session context.

Avoid `npx desk` outside the
desk folder, because it resolves the registry's unrelated `desk` package. The hooks and settings
`desk sync` writes call `node <desk>/node_modules/agent-desk/...`. Until that copy is installed, the
hooks and the shim call the kit that ran `desk sync`. A global install
(`npm install -g github:klintravis/agent-desk`) is optional and only puts a `desk` on your PATH that
finds the desk from the current folder. The hooks and the shim still use the pinned copy.

**Claude Code plugin.** The repo is its own marketplace:

```text
/plugin marketplace add klintravis/agent-desk
/plugin install agent-desk@agent-desk
```

The mod part (everything under `hooks/`) runs only when Claude Code's function hooks are on
(`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`). With them off the engine does not load it, so it does
nothing; the skills and agents still work. Outside a desk the mod runs only what does not depend on
a desk: auto-compaction prune, secret redaction and the session meters. No pane, warm-hold, edit
guard or context.

### Secret redaction

Secrets (vendor key shapes, private keys, connection-string passwords, high-entropy tokens next to a
key's name), email addresses and public IP addresses are swapped for a stable placeholder such as
`[REDACTED-SECRET-1a2b3c4d]` (`[REDACTED-EMAIL-...]` and `[REDACTED-IP-...]` for addresses) in what you type, in tool results and (secrets only) in the context
blocks of the first message. The same value always gets the same placeholder, and a placeholder in a
tool call's input is swapped back for the real value, so `curl -H "Authorization: <placeholder>"`
still sends the key. The values live in the session's memory only. Git SHAs, checksums, file paths,
names in code, Stripe and YouTube public ids, example and noreply addresses, private,
loopback and documentation IP ranges, and a connection-string password that is one template
placeholder holding a bare name or dotted path and no default value (`${pass}`, `{{db.pass}}`) are kept; `<password>` is hidden like any password. A toast or a notice under the tool says how many
values were hidden. There are no options; the defaults are secret-redactor's.

The vault is in memory only, so placeholders in a resumed transcript do not restore. Placeholders are
not swapped back in the input of `Agent`, `SendMessage` and `AskUserQuestion`, which carry your words
to another model. Redaction fails open: on an internal error the text goes through unchanged rather
than blocking a send. Notes a settings hook attaches to a tool result (its `context`) are not scrubbed.

### Session meters

The mod keeps one status line under the prompt (the engine allows one per plugin), shared by
the meters and, in a desk, the warm-hold mode and the decision flag:
`ctx ▰▰▰▱▱▱▱▱ 42% · 5h ▰▰▱▱ 42% · warm auto · ⚑ 1`. The `warm` and `⚑` slots appear only in a desk
(`⚑ n` only while n owner decisions wait). The longer forms of each meter are rows of the Desk pane.

- **Plan quota.** Pane row `5h ▰▰▰▰▱▱▱▱▱▱ 42% · resets 2h10m · 7d ▰▰▱▱▱▱▱▱▱▱ 18% · 5h full in ~3h05m`:
  the 5-hour and 7-day window use, the 5-hour reset countdown, and the first window that fills before
  it resets at the current burn rate. The rate needs samples over a twentieth of the window (15 min
  for 5h); until then it says `collecting burn rate`. Samples persist in the plugin store (key
  `quota-samples`) across sessions. No row when the host reports no limits (an API key, no subscription).
- **Context fullness.** Pane row `▰▰▰▰▱▱▱▱▱▱ 42%  84k/200k`: the main session's context use after its last
  response, green, orange from 60% and red from 80%. From 80% the band above the prompt also shows
  `ctx ▰▰▰▰▰▰▰▱ 85%  near full: handoff or /compact`, in any session.
- **Cache.** Pane row `94% hit`: the main session's cache read / all input, the same ratio `desk tokens`
  reports per day. No dollar amount: cost differs by plan.

### Cold-cache guard (in a desk)

When you send a prompt and the main cache has been idle past its hour with 50k+ tokens of context,
the mod logs what the send costs: `cache cold for 12m: this send re-writes ~330k tokens, ~20x a warm
turn's input`. The send goes through. With `AGENT_DESK_COLD_GUARD=refuse` in the session's
environment, the first such send is dropped with that text instead, and the resend goes through.
A session that starts with a context already in it (a resume) counts as cold until its first request.
Only your own sends are checked, not slash commands or plugin and peer messages. After a cold write
lands (the send above, or a turn that rewrote half its context without reading it back from the
cache, which a big file read does not), warm-hold arms for 3 hours even
with no agents running, so the rewrite is not paid again soon. There is no dollar figure, because
the kit keeps no price table.

### Warm-hold (in a desk)

While this session has agents pending or running, the mod pings the main session 50 minutes after
its last request, just before the cache's hour, so the next turn reads the context instead of
rewriting it. The pane's Warm row shows `2 agents running, ping in 12m`, and its button
toggles `auto` / `off` for this session only (never stored: a new session starts on `auto`). While
`off` the hold never arms or pings, and the cold-send warning drops its "Warm-hold arms" sentence. The hold stops, and
says why (`warm-hold off: ...`), when the cache is already cold, after 4 hours (the cap), when a
ping fails, or when a ping finds the cache gone. After a cold write it arms with no agents running
(see the cold-cache guard above). The ping is a model fork whose reply is the word `ok`.

### Auto-compaction prune

On an automatic compaction, in the main session and in subagents, the mod first cuts re-readable
tool output: an output over 1500 characters keeps its first 400. The first message and the newest 8 messages, the
output of `Agent` and `Task`, errors, and snapshots of state that has moved on (`git status`,
`git stash list`, `gh run view`, `gh pr checks`) stay as written, and the file-write tools' inputs
are shortened the same way. The conversation stays word for word. If that saves under 30% the
engine's own summary runs instead, as it does for a manual `/compact`. A toast says
`tool output cut, context -N%`. A prune error never blocks compaction.

### Desk pane

In an interactive session inside a desk, or once a surface attaches (the VS Code extension, the desktop app, a phone), the mod opens the **Desk** pane (`desk-status`) beside the
chat. Its rows: Context, Quota, Cache with the output style (`default` when none), Warm (the
keep-warm toggle and why), today's Tokens and Roots. Then a line counting what waits
(`1 ready to merge · 1 needs review`, in the colour of the worst, absent when nothing does), then three tabs, the same panels as the [VS Code extension](vscode/README.md):
**Decisions** (each waiting decision with its options and whys, and a `Decide T-n` button; a yellow dot on the tab while one waits),
**Work**, the default (open branches, most urgent first, each one row with one state word such as `ready`, `rebase` or `fixes needed` and who holds it, and the active todos on it;
claims with no branch; agents with type, description and age, first seen on the minute tick; pull requests; overlaps by file, the top three and `+N more`; each running
session by its transcript title, marked `this session` when it is, with its id and agents) and
**Todos** (what is open and not in Work, active first, then by priority, the first ten and `+N more`; owner decisions and ideas stay out, an active idea excepted). A card on Work takes the border of its worst status, and the tab shows a red dot
while one is red. Nothing shows twice: an active todo on a branch or claim is in Work only, and an open PR is said on the Pull requests card, not again on its branch. The status sections refresh every minute from `desk status --json`. A band above the prompt shows
`⚑ 2 decisions waiting` with a `Decide T-n` button, and the near-full context row (any session).
Either button walks the waiting decisions in a dialog: the question, its context and each option's why above the options,
Other for your own words. A chosen option records its short label; your own words are recorded after redaction, on one line, cut to 1000 characters (`desk decide`). The next decision follows;
closing the dialog records nothing and gives the reason in a toast. A decision with fewer than 2 or more
than 4 options shows in a toast instead and, where the surface's prompt box takes it and holds no draft,
leaves `/decide T-n ` there: type the ruling, Enter. Otherwise type the printed Answer line.
Two commands are registered: `/desk` opens the pane, and `/decide` walks the waiting decisions in the same dialog as the button
when the next one has 2 to 4 options, and its answer names the way out if no dialog opens. With none waiting, with other option counts, or
where no dialog is possible, as in `-p`, it prints the next one as text. As
`/decide T-n <ruling>` or `/decide T-n --pick <n>` it records one (it runs `desk decide`). If `/decide` is not in your slash menu, as seen in VS Code, use the plugin's
`decide` skill: plugin skills are listed namespaced, so `/agent-desk:decide`. It does the same walk with AskUserQuestion (each option's why as its description). The pane's data are plugin atoms whose
shapes (`status-2`, `meters-2`, `warm-1`, `style-1`, `agents-1`) are declared in `types/index.d.ts`.

## Quickstart

```sh
mkdir desk && cd desk
npx github:klintravis/agent-desk init --repo app=../app --repo api=../api --repo notes=../notes
# `desk` below is the desk's shim: ./desk (bash), <desk>/desk elsewhere (PowerShell or cmd: the node form above)
# edit desk.config.json: install/build/check per repo, gh where CI lives on GitHub
desk sync
desk todo add "first piece of work" --area app
desk wt new first --repo app        # worktree ../worktrees/app-first on agent/first
# ... work, commit ...
desk wt finish first                # repo check, push, wait for CI
desk board post verdict first "MERGE @<head sha>"   # after a clean review
desk wt merge first                 # ff-only merge, push, todos closed, worktree removed
                                    # (merge: "review": opens a PR; re-run after a person merges)
desk status
```

What `desk init` does:

- A path that holds `.git` becomes a git repo: `gh` comes from the `origin` URL (GitHub only) and
  `defaultBranch` from `origin/HEAD`, else the checked-out branch, else `main`. Any other folder
  becomes a plain folder. `--repo <id>` without `=<path>` means the desk folder itself; a missing path
  or an id that is not lowercase letters, digits and dashes is an error.
- It writes these files: `desk.config.json`, `AGENTS.md`, `CLAUDE.md` (which imports `AGENTS.md`),
  `agent-rules.md`, empty `todo.jsonl`, `board.jsonl` and `decisions.jsonl`, `.gitignore`,
  `<desk>.code-workspace`, the `desk`/`desk.cmd` shim and `package.json`, which pins the kit (an
  existing `package.json` gets the devDependency added). Then it runs `npm install`.
- It never overwrites the content of an existing file it wrote (the files above and `package.json`),
  with these exceptions: the `folders` list of the `.code-workspace` file (its settings stay) is
  refreshed on every run, and `init` and `sync` rewrite a `desk` or `desk.cmd` that carries
  the `written by desk sync` marker. A file or folder of that name without the marker is left alone
  with a warning, and the command exits 1. When `.claude/agent-rules.md` exists (an older desk), it
  writes no second `agent-rules.md`.
- Every line the CLI writes to `todo.jsonl`, `board.jsonl` and `decisions.jsonl` carries `"v": 1`.
  The JSON Schemas of these files and of `desk.config.json` are in the kit's `schemas/`; `desk check`
  prints a warning per line that breaks them (at most 5 per file) and the readers skip a line they
  cannot parse.

`desk sync` then writes each harness's files:

- **Claude**: `.claude/settings.local.json` in the desk, in every git repo checkout and in every
  open worktree. The file sets `DESK_HOME`, the readable directories, and the `SessionStart` and
  `SubagentStart` context hooks.
  - In checkouts and worktrees it also carries the desk's own `.claude/settings.json`: its
    permissions, env, hooks and every other key (`autoMode`, `enabledPlugins`, cache TTLs, ...), since
    a session opened there never reads the desk's file. Give the desk's hook commands absolute paths.
    Object keys such as `enabledPlugins` merge with yours; the desk's value wins on other keys.
  - The hook command carries the desk and the checkout, so a worktree session finds the desk even
    when `env` is not applied. In a multi-root VS Code workspace only the checkout that holds the
    session answers, so Copilot gets the context once.
  - On a re-sync, your own keys, env vars, permission entries and hooks are kept. `allow`, `deny`,
    `ask` and `additionalDirectories` become the union of yours and the desk's.
  - An entry the desk wrote last time and no longer writes is removed: a permission entry, a hook,
    a key, an env var, or one entry of an object key (a plugin in `enabledPlugins`; yours stay). The
    record of what it wrote is `.claude/synced-permissions.json` (names only, no values). A matching
    entry of your own is removed with it.
  - If the desk's `settings.json` is not plain JSON, no checkout is rewritten and `desk sync` exits 1,
    so a typo there cannot strip the guards from the worktrees.
  - Your hooks stay, including any that share a group with the desk's hook.
  - A file that is not plain JSON, such as one with JSONC comments, is left untouched with a
    warning, and `desk sync` exits 1. The same applies to the `.code-workspace` file, even when it
    is the only broken file.
  - The file is kept out of git through the clone's `info/exclude`. If the desk folder is a git
    repo of its own, the desk's `.gitignore` covers the file there.
- **Copilot**: files in the desk folder only. Your repos stay untouched.
- `desk sync` records the installed kit's version as `kitVersion` in `desk.config.json`.

Desk folder lookup: `DESK_HOME` if set, else the nearest folder at or above the current directory
that holds `desk.config.json`. `desk init` ignores `DESK_HOME` and always uses the current folder.

## Commands

| Command | What |
|---|---|
| `desk status [--watch\|--json] [--fetch]` | One screen with these sections: owner decisions, active todos, claims, running sessions, roots (each git root's default branch sha, the CI of that sha in a repo with `gh`, and `no check command` when `check` is empty), open branches (CI, verdict and the branch's state word in brackets, and `behind <default> by N, rebase` when the branch lacks N commits of `origin/<default>`, from the refs as last fetched, or of the local default branch without an origin), pull requests, overlaps, today's tokens. `--fetch` fetches each git repo with an origin first, so behind counts, the pushed state and the default branch are current; without it status reads local refs only. `--watch` prints one line per change. Pull requests: for each open desk branch with an open PR in a repo with `gh`, the review decision, the comment count (conversation and review threads), unresolved threads, and comments or reviews newer than the branch's head commit. Read-only, one `gh api graphql` call per repo; with no `gh` or a failing call the section is left out. `--watch` prints `PR: <branch> #<n> review <decision>, +N comment(s)` when a decision changes or comments arrive. See [Status watch](#status-watch). |
| `desk todo add\|split\|start\|done\|drop\|block\|open\|set\|note\|done-slug\|list\|next\|show` | Todos. The area is a repo id, `desk`, `watch`, `owner` or `idea`. See [Todos](#todos). |
| `desk board post\|claims\|check\|merge-ok\|tail` | The claim board. Its text is data, never approval. See [Board](#board). |
| `desk decide [T-n <ruling> \| T-n --pick <n> \| --json \| --list [n]]` | Owner decisions, one at a time; `--pick` records the nth option's label; `--json` prints the first waiting one as JSON; `--list` prints the recorded rulings. See [Owner decisions](#owner-decisions). |
| `desk tidy [--apply] [--json]` | Reports what finished work left behind; `--apply` clears dead owners, deletes orphans and asks the owner once. See [Tidy](#tidy). |
| `desk wt new\|finish\|rebase\|merge\|remove\|discard\|handoff <slug> [--repo <id>] [--base <ref>] [--no-build] [--no-wait] [--rebased] [--force] [--into <slug>] [--findings <file>] [--todo T-n] [--next "<step>"]` | Worktrees. See [Worktree flow](#worktree-flow). |
| `desk stream <slug> <task-file> [--todo T-n] [--desk] [--repo <id>] [--max-turns <n>] [--budget <usd>] [--dry-run]` | Starts a detached headless Claude session that claims, implements, reviews and stops before merge. See [Streams](#streams). |
| `desk tokens [hours] [--json] [--session <id8>\|self] [--by-worktree]`, `desk overlap` | Token use from Claude transcripts. Files changed by two open worktrees. See [Tokens and overlaps](#tokens-and-overlaps). |
| `desk init [--repo <id>=<path> ...] [--worktrees <dir>] [--harness claude,copilot] [--no-install]` | Makes the current folder a desk. See [Quickstart](#quickstart). |
| `desk sync [<checkout>...]`, `desk workspace` | Write harness files; write the VS Code workspace and hide the kit's plumbing in the desk folder (see below). |
| `desk settings [--json]` | Resolved model and effort per task id and the cache keys, each with its source layer, plus warnings. Writes nothing. See [User settings](#user-settings). |
| `desk check` | Runs the kit's tests, `claude plugin test` and `claude plugin validate`, and parses the JSON configs. On a `review` repo it also reads the server's branch protection through `gh api` and flags a changed `merge` setting (warnings only; a `direct` desk runs one or two local `git show` calls for that flag and no `gh`). Warns when `kitVersion` differs from the installed kit, and for each desk-file line that breaks its schema (`schemas/`). |
| `desk home` | Prints the desk folder; exits 1 outside a desk, or when `DESK_HOME` names a folder without `desk.config.json`. |
| `desk --version`, `desk --self-test`, `desk <command> --self-test` | The kit version. The built-in self-tests of the whole CLI, or of one command (`board`, `todo`, `tokens`, `status`, `overlap`, `decide`): print `ok` or `FAIL` and a list, exit 0 or 1. |
| `node <kit>/scripts/friction-scan.mjs [--since <ISO time>] [--json]` | Scans the Claude transcripts of the desk's sessions and subagents for friction: tool errors, permission denials, oversized outputs, repeated commands. Prints a short summary. Read-only. |

### Worktree flow

`wt` and `stream` each take only their own flags: they exit 1 on an unknown flag or a value flag without
its value.

- **`wt new`**:
  - Branches `<branchPrefix><slug>` from `origin/<defaultBranch>` (`--base <ref>` starts from another
    ref; a repo with no `origin` starts from its local default branch).
  - Writes the settings and posts a claim.
  - Copies the repo's optional `copy` paths (relative; gitignored files such as `.claude-plugin/types`) from the main checkout, skipping any that is missing.
  - Runs `install`, then `build`. `--no-build` skips the build.
  - Slugs are desk-wide: a slug already open in another repo is refused.
- **`wt finish`**:
  - Refuses uncommitted changes, and refuses a worktree that is not on `<branchPrefix><slug>`.
  - Runs `check`, then pushes. Use `--rebased` (`--force-with-lease --force-if-includes`) after a rebase; a push git rejects as
    non-fast-forward says so.
  - `--no-wait` pushes and prints the `gh run list` command instead of waiting.
  - Waits for every GitHub Actions run on the pushed head through `gh`. CI is green only when
    every run succeeded or was skipped. The repo's workflows must run on pushes to every branch
    (`on: push: branches: ['**']`), not just `main`: otherwise there is no run to wait for.
  - Gives up after 30 minutes for all runs together (a dead runner): CI is reported `running`, with
    the `gh run watch` command per open run, and the exit code is 1.
- **`wt rebase`**: refuses what `wt finish` refuses, fetches, rebases on `origin/<defaultBranch>`, then runs the
  `wt finish --rebased` path (check, `--force-with-lease --force-if-includes` push, CI wait). A conflict aborts the rebase and leaves the
  worktree at its old head. It runs `git range-diff` from the reviewed commit (the sha of the newest board verdict,
  else the head before the rebase, said so) to the new head and prints whether only context changed or which
  commits differ, plus the old and new head (when the reviewed commit is the head or an ancestor of it, it skips range-diff and says it is unchanged), and names the verdict word (`MERGE`, `FIXES NEEDED`) of the reviewed commit.
  It posts no verdict: `wt merge` still needs `MERGE @<head>`. It says "Already up to date" and pushes nothing only
  when the head did not move and origin's branch already equals it; otherwise it checks and pushes. The push uses
  `--force-with-lease --force-if-includes` (Git 2.30 or newer), so a commit pushed to the branch from elsewhere makes it fail.
- **`wt merge`** needs all of these:
  - the branch is pushed
  - CI is green
  - the newest board verdict for the slug is `MERGE @<sha>` and covers the branch head
  - the main checkout is on the default branch and clean

  It then fast-forwards the default branch (ff-only), pushes it, closes the todos started with
  `--slug`, posts `merged` and removes the worktree. If git refuses to remove it (modified or untracked
  files, a lock) git's reason is shown, the worktree and the claim stay and it exits 1: fix that, then
  `desk wt remove <slug>`. If git unregistered the worktree but the folder stayed (a shell holds it on
  Windows) the merge still closes: it prunes, deletes the branch when git allows, posts `release`,
  warns which folder to remove by hand and exits 0.
- **`wt merge <slug> --into <other-slug>`** merges the branch into another agent worktree's branch
  (same repo, target clean and on its branch), then closes the source. On a conflict it aborts and
  leaves both as they were. Allowed under both policies; `--findings` is refused with it.
- **`wt remove`** removes a worktree and its branch once the branch is in `origin/<defaultBranch>`
  (`merge` calls it), and posts `release`. Like `merge`, it fails (`cd out of <path> first`) when your
  current directory is inside the worktree. If git unregistered the worktree but the folder stayed, it
  finishes the same way as `merge`: branch deleted, `release` posted, a warning, exit 0.
- **`wt discard`** drops the worktree and its branch, uncommitted work included, and posts `release`.
- **`wt handoff <slug> --next "<step>" [--todo T-n]`** ends a session's turn on a worktree it keeps open: it writes the
  slug's active todo's `state` from facts (`head <sha>, clean|uncommitted changes, pushed|not pushed, CI <result>, verdict
  <verdict>`, the verdict without its `by` part, since `todo.jsonl` is committed) and `next`, then posts `release`.
  It refuses a slug another session holds; `--todo` names the todo when none is active on the slug.
  It refuses a slug another session holds unless you pass `--force`, and, like `merge` and `remove`,
  runs only from outside the worktree. If only the folder stays (git no longer lists the worktree) it
  finishes with a warning naming the folder; if git still lists it, it fails and keeps branch and claim.

### Merge policy

Per repo, `merge` in `desk.config.json` is `direct` (the default; everything above) or `review`.
Under `review`, agents never merge into a protected branch (every branch outside `branchPrefix`):

- `desk wt merge <slug> --findings <file>` keeps the pushed, CI and verdict gates, then opens or
  updates a pull request carrying the verdict (its sha only) and the findings file, and stops. It
  never fast-forwards or pushes the default branch. Re-running it without `--findings` only prints
  the PR state.
- A person merges on the server (squash and rebase work). Re-run `desk wt merge <slug>`: it asks
  `gh` for the PR state, then closes the worktree, branch, claim and todos. `desk status` and the
  Desk pane show `PR #n merged: desk wt merge <slug> to close` (just `PR #n merged` when that PR's head
  does not hold the branch's head: a new commit or a reused slug).
- `desk wt remove` on an unmerged `review` branch points to `desk wt merge`.

**Only the server rule is a guarantee.** Set a branch protection rule or ruleset on the default
branch and every release branch that requires a pull request and blocks direct pushes, and
dismisses stale approvals. Nothing below replaces it:

- **The merge guard** (Claude plugin; `scripts/merge-guard.mjs` is the same check as a standalone
  `PreToolUse` script) refuses an agent's `git push` or `git merge` to a protected
  branch, and `gh pr merge`, in Bash and PowerShell. It is a best-effort parse. A line it cannot
  read that names `push` or `merge`, or has a backslash after `$'`, is refused on any desk with a `review` repo; its other errors
  (git, a broken config) allow the command.
  Tag pushes (`refs/tags/*`, `--tags`) pass; a bare `git push origin v1.2` is refused.
- **The `desk.config.json` deny**: on a desk with a `review` repo, `desk sync` denies the file-edit
  tools on that file, and `desk check` warns when the setting changed against upstream. It stops
  only Claude's edit tools, in sessions using the synced `.claude/settings.local.json`.
- `desk check` warns when the server shows no protection on the default branch (or `main`), and when
  it cannot read it. It never fails on this.

Known not to be covered: Bash or PowerShell edits of `desk.config.json`, a `cd` that the guard
cannot follow (`popd`, `cd -`), `bash -c`, `eval`, scripts and aliases, `$VAR` and `$(...)` as
branch names, bash `git {push,} origin main`, `a[ 0 ]=x git push`, `a[x y]=x git push`, `a["]"]=x git push`, `a[b[0]]=x git push`, `env GH_REPO=o/a GH_REPO+=b gh pr merge` (env sets `GH_REPO+`, read here as an append), `GH_REPO=o/a env GH_REPO+=b gh pr merge 1`, `echo ${x:-$(git push)}`, `echo ${x:-'}'}; git push #'` (a `${...}` ends at its first `}`, whatever the quotes), `` echo `echo '`; git push; echo `echo '` `` (a backtick body with an odd quote is read past its backtick), PowerShell `[string] $x = git push` (spaced type), `$a[$i + 1] = git push`, `$a[ 0 ] = git push`, `($a,$b) = git push`, `$o.($k) = git push`, `$o[($k)] = git push`, `[Console]::Title = git push`, `$a <# x #> = git push`, `<# x #> git push`, `return git push`, `$(git push)` inside `@"..."@`, `@{ x = git push }` and its family (a PowerShell hashtable value whose key is only a `$(...)`, sits in parentheses, or has no `$`: `@{ "$(a)" = git push origin main }`, `@{ "$()" = ... }`, `@{ ("$x") = ... }`, `@{ "x" = ... }`, `@{ $() = ... }`), `. git push` and PowerShell 7's ``"pu`u{73}h"``, a quote spanning two lines of a heredoc fed to a shell, `gh api` ref writes, local commits on the main checkout (their push is refused),
Copilot, and any session without the plugin or the synced settings. `git push` with no refspec under
`push.default=upstream` goes to the upstream while the guard judges the current branch: a worktree
made from `origin/<defaultBranch>` tracks it until its first `desk wt finish`, so there it reaches
the default branch (git's default `simple` refuses that push). Heredoc text with a line starting
`git push origin main` is refused by mistake. A broken `desk.config.json` turns the guard off.
`desk check` on a `direct` desk runs one or two local `git show` calls for the setting change flag
and no `gh`.

### Todos

`todo.jsonl` is append-only: each line sets fields on one todo and a todo is all its lines merged in
order, so two sessions never overwrite each other. Area `watch` holds what still has to be verified
live; area `owner` holds the decisions only the owner makes; area `idea` holds quick thoughts that are
not work yet: `todo add "<thought>" --area idea`, then `todo set T-n --area <repo id>` to promote one or
`todo drop T-n` to let it go.

- `todo add "<title>" [--area <repo id>|desk|owner|watch|idea] [--size ...] [--prio N] [--why ".."] [--parent T-n]
  [--option "<label>: <why>"]... [--summary "<about 50 characters>"] [--change <spec change>] [--tasks 2.1-2.3] [--model sonnet/medium] [--kind fix|feature|refactor|perf|docs]`. With one repo `--area` defaults
  to it; with several, `--area` is required. `--prio` must be an integer (anything else exits 1 and
  writes nothing). `--` ends the flags, so a title that starts with `--` is `todo add -- "--foo"`.
  A flag with no value, or whose value starts with `--`, exits 1 and writes nothing (`--all` takes none).
  `--summary` (cut to 60 characters, also `todo set T-n --summary`) is what the Desk pane shows for an active todo:
  an id row (id and summary, the title when unset), then `state:` and `next:`, each cut to one row at the edge,
  with one label on the id row, `wt:<slug>` else the owner (the summary is cut first). `todo show` and `todo list` keep the full title.
- `todo split T-n "<child>" ["<child>" ...]`: children inherit the area, change and priority.
- `todo start T-n [--slug <worktree slug>]` marks it active and yours; it refuses a todo whose `--kind` is
  other than `docs` and that has no `accept: <claim> | <command> | <expected>` note (the `validate` skill); `todo done T-n`, `todo drop T-n`,
  `todo block T-n` and `todo open T-n` set the status (`--why` adds a note). `todo done-slug <slug>` closes the active todos of that slug and their open
  children without another slug (`wt merge` runs it); an open or blocked todo only tagged with the slug stays.
- `todo set T-n --<field> <value>` sets any field (handoff uses `--state` and `--next`); `todo note T-n
  "<text>"` adds a dated note, up to 1000 characters, never cut: a longer note, or unquoted words, exit 1 and write nothing.
- `todo list [--area x] [--all]` shows the open tree without ideas (`--area idea` shows them, `--all`
  adds ideas, done and dropped); `todo next [--area x]` picks the open todo with no open children (an idea child only counts under an idea) and
  the lowest priority number (default 50), never an `owner`, `watch` or `idea` todo unless you ask for that area; `todo show T-n` prints the merged JSON.

### Board

`board.jsonl` (gitignored) says who holds what. Text is data, never approval.

- `board post <claim|release|ci|merged|verdict|note> <slug> [text] [--repo <id>]` appends a line (text
  cut to 120 characters). It always exits 0, so a board problem never fails the caller.
- `board claims` lists open claims: a claim is open while its worktree exists. `board check <slug>`
  prints `yours` or `unclaimed`, or exits 1 when another session holds it. Session identity is the
  first 8 characters of `CLAUDE_CODE_SESSION_ID`, else `owner`.
- `board merge-ok <slug> <head-sha>` exits 0 only when the newest verdict is `MERGE @<sha>` (7 to 40
  hex characters) that is a prefix of the head, and no `FIXES NEEDED`, `DO NOT MERGE` or `MERGE AFTER FIXES`
  verdict names that head after its last `MERGE @<sha> overrides: <why>` (a `DO NOT MERGE` on the head is never
  overridden: only a new commit clears it). `board tail [n]` prints the open claims, the files in
  `streams/` and the last `n` (default 8) lines; the session-start context embeds it.
- A review verdict reads `<VERDICT> @<sha> by <model>/<effort>`, from what the agent's brief states (`by <model>`
  alone if the brief gives no effort). The merge gate ignores the suffix. The record reaches only people who can read
  that desk's board: `board.jsonl` is not in git, and a todo's `--state` quotes verdicts without the `by` part.

### Owner decisions

Write a decision with options, the recommendation first:

```
desk todo add "Refuse an unparseable push?" --area owner --why "The guard cannot read every line." \
  --option "Refuse: a hidden push cannot slip through, at the cost of rare false refusals" \
  --option "Allow as before: no false refusals, but a hidden push can pass"
```

`--option "<label>: <why>"` is repeatable and splits at the first `: `. Give 2 to 4, with labels of at most 60
characters (the dialogs take 2-4 short labels); anything else is refused. `--why` is then the context of the
question. A todo with only `--why` still displays: its text is split on `;` into options, and `Label: rationale`
parts are read as label and why only when every part has a short, distinct label other than `Recommended`, `other` or `or`.

`desk decide` prints the first waiting `owner` todo: its title, its context, the recommendation and the other
options, numbered from 1, each with its why under it. `desk decide --json` prints the same decision as
`{id, title, context, options: [{label, why}]}`, or `null` when none waits. `desk decide T-n '<ruling>'` appends
`{date, todo, title, text}` to `decisions.jsonl`, then closes the todo: choosing an option records its label, and
your own words are allowed too. `desk decide T-n --pick <n>` records the nth option's label, counted from 1 as `--json`
lists them, so the label never crosses a shell; `--pick` counts only as its own argument, so one argument reading
`--pick 3` is plain text. A position that is not a whole number or out of range, or a todo with no options, exits 1 and
closes nothing. A ruling shaped like a secret also exits 1, recording nothing and closing nothing,
since `decisions.jsonl` is committed. `desk decide --list [n]` prints the last `n` rulings (default 20), oldest first.

### Tidy

`desk tidy` reports what finished work left behind and writes nothing. `desk tidy --apply` acts on the report, and the
`handoff` skill runs it; `kickoff` reads the report. `--json` prints the report as one object. Tidy never closes a todo
and never writes `board.jsonl`.

- **Dead owners.** An open todo's `owner` is cleared when that session's newest transcript in a desk project folder
  (subagents included) is over 24 hours old and the session holds no open claim. Only `owner` changes, plus a note: the
  status, `state` and `next` stay. A missing transcript means unknown: it is listed and never cleared.
- **Orphan files.** Only `streams/<slug>.md` and `<slug>-prompt.txt`, `<slug>-run.jsonl` and `<slug>-run.jsonl.err` in
  `scratchDir`, directly in those folders, never a link. Deleted for good, and only with all of: no worktree for the
  slug, no open todo for it, at least 24 hours old, and a board line (`<slug>` or `desk-<slug>`) or closed todo naming it. A failed stream's log
  therefore survives while its todo is open. With no worktrees folder, every file is kept and listed.
- **Stray worktree folders.** A folder in the worktrees folder whose name is a repo's worktree prefix plus a valid slug,
  and that `git worktree list` does not name, is listed (`strayFolders` in `--json`). Tidy never deletes one, even with
  `--apply`: it may hold files. If the listing fails for a repo, that repo's folders are listed as kept, not stray.
- **The owner question.** Tidy lists todos that look finished (merged slug with no worktree, or a parent whose children
  are all closed), stale (not area `owner` or `idea`, not updated for 14 days, with no open child or claim) or forgotten (area `watch`, 14 days). It
  raises them as one `owner` todo with `source` and `tidyIds` for `desk decide`; while that todo is open it raises no
  other. An id an earlier question named is not raised again, so keeping a todo sticks; `desk tidy` still lists it.

The 24 hours and 14 days are constants in `lib/tidy.mjs`, not config.

### Tokens and overlaps

`desk tokens [hours] [--json] [--session <id8>|self] [--by-worktree]` reads the Claude transcripts of sessions run in
the desk, its repos and its worktrees, for the last `hours` (default 24). Per session and subagent: calls,
peak context (the fullest prompt), fresh input (input plus cache writes), output, cache percent
(cache read over all input), time, depth (0 a main session, 1 its subagent, 2 a subagent's subagent) and parent (`main`, or the
spawning agent's id, matching `agent-<id>.jsonl` in `file` of `--json`). Two lines before the total cover the subagents: runs and nested runs, the first call's share of fresh
tokens, cache reads per call, and warm starts (a first call that reads 5k or more from cache) as `warm/runs` by the gap
since the last spawn of that agent type and model, in the listed rows. `--session self` limits it to the current session
(`CLAUDE_CODE_SESSION_ID`). `--by-worktree` prints one row per worktree instead (calls, fresh, output, cache
percent; largest fresh first), so what one change cost needs no adding up. `--json` rows always carry `worktree`, `depth`, `parent`, `firstFresh` and `firstRead`; a main session's row also has `title`, a subagent's `type` and `about`, and a subagent row with calls `sinceSpawn` (seconds since that last spawn, null on the first).

A transcript's worktree is the slug (`<repo>:<slug>` with several repos) from `desk.config.json` alone, so removed
worktrees count: a main session takes the worktree of its first working folder, else the one its first message names;
a subagent takes the one its brief names, else its parent's. Everything else is `(desk)`. Limits: the window is the
transcript's modified time and a transcript in it counts whole, so a long change needs a large `hours`; transcripts
Claude Code has deleted are gone; a subagent brief that gives only a slug falls back to its parent's worktree.
The brief is read in memory and never printed. `desk overlap` prints one `a + b: file, file` line for each pair of open
worktrees of one repo that changed the same file (committed against the default branch, plus uncommitted).

### Status watch

`desk status` is one screen with these sections: Owner decisions waiting, Active todos, Claims,
Running sessions (transcripts written in the last 10 minutes, each by its title with its id, worktree and agents), Roots (each git repo's default branch
and its sha), Open branches (CI and review
verdict per branch, and `behind <default> by N, rebase`), Pull requests (when a repo has `gh`), Overlaps and Tokens today. A source that
cannot be read prints `unavailable`; the command never fails.

`desk status --json` prints the same data as one JSON object (`decisions`, `active`, `todos`, `claims`,
`sessions`, `roots`, ..., plus `text`, the screen above), validated by `schemas/desk-status.schema.json`.
`todos` is what is open, active or blocked and not in Work (an active todo whose slug has a branch or claim is in Work), without owner decisions and with an idea only while it is active.
Each branch carries `state`, one word (`ready`, `needs review`, `rebase`, `fixes needed`, `CI failed`, ...) computed
by the rule `desk wt merge` uses; the Desk pane and the VS Code sidebar read it and do not parse CI or verdict text.

`desk status --watch` (run it under a monitor) checks every 90 seconds and prints one line per change:
`BOARD: <json>` for a new board line, `CI: <branch> <sha> completed <conclusion>`,
`AGENT+: <session> <agent> (<model>)` for a new running agent, `CTX>250k: ...` when one passes 250k
tokens of context (printed once ever per agent run, like `OWNER+:`), `OVERLAP: <pair>` (also posted as a board note), `OWNER+: T-n <title>` for a new owner
decision (printed once ever) and `PR: ...`. A failed look keeps the last good one.

### Streams

`desk stream <slug> <task-file>` writes the prompt and the log to `scratchDir`
(`<slug>-prompt.txt`, `<slug>-run.jsonl`, `<slug>-run.jsonl.err`) and starts a detached headless
`claude -p` in the desk folder that claims, implements, reviews and stops before merge.

- `--todo T-n` tells the run to start and split that todo; `--repo <id>` picks the repo.
- `--desk` is desk work: edit the desk folder directly, no worktree pipeline.
- `--max-turns <n>` (default 80). `--budget <usd>`, or `budgetUsd: 5` in a front matter block at the
  top of the task file, passes `--max-budget-usd`; the flag wins; default none.
- `--dry-run` prints the command and the prompt and starts nothing.
- The child does not inherit `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT` or
  `CLAUDE_CODE_SSE_PORT`, so the board credits its claims to it and it cannot attach to the caller's
  socket. `DESK_HOME` is set for it.

## User settings

Each user can tune model, effort and cache for themselves in `~/.agent-desk/settings.json`, without changing a file the
team shares. The kit reads this file and never writes it, and nothing from it reaches a committed file. It is for
choices, not secrets: `tasks`, `cache` and `$schema` are the only keys read, and anything else warns by name and is
ignored. A malformed file warns and is ignored. It never breaks a command. The shape is in
`schemas/user-settings.schema.json`.

```json
{
  "tasks": { "review": { "model": "sonnet", "effort": "medium" }, "memo": { "model": "fable" } },
  "cache": { "promptCacheTtl": "5m", "subagentPromptCacheTtl": "5m", "idleCompaction": false }
}
```

**Tasks.** The ids are the `Id` column of the table in `skills/orchestrate/SKILL.md`; `desk settings` lists them. Models are `haiku`, `sonnet`, `opus`, `fable` and efforts are `low`, `medium`, `high`, `xhigh`, `max`, each from
lowest to highest; full model ids are rejected. For each value, last wins: the kit table, `tasks` in `desk.config.json`,
your file, then the desk's `floor`, which only raises. `desk settings` shows the result and the source of each value.

The `orchestrate` skill applies resolved values when it spawns an agent, and falls back to its table if `desk settings`
fails. An agent started outside `orchestrate` runs on its frontmatter or its caller's parameters, so none of this
reaches it. `kickoff` and `handoff` write no model or effort into `todo.jsonl` (that file is committed, the user file is
not): a todo carries its kind, and the task id it maps to is resolved at spawn. `desk wt handoff` drops the `by` part of a
verdict for the same reason.

**Floor limits.** A floor holds in the resolver's output and in what the skill passes. It is not a security boundary:

- `CLAUDE_CODE_EFFORT_LEVEL` beats the effort the skill passes, up or down.
- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` replaces the model.
- `maxEffortLevel`, org caps and unsupported levels lower effort, and an allowlist can swap a blocked model.
- A user can edit `desk.config.json` or ignore the skill.

`desk settings` and `desk check` warn about the first two when they can see them. A real limit needs managed settings.

**Who sees a cheaper choice.** `desk status` shows your own lowered values and floor raises in one line under the
heading. `reviewer` and `verifier` record the model and effort on their verdict (see [Board](#board)), which reaches only
people who can read that desk's board.

**Cache.** Claude Code ranks a desk's committed `.claude/settings.json` above `~/.claude/settings.json`, so a value in your
own Claude settings is shadowed in a desk that sets the key. `desk sync` and `desk wt new` write `cache` into
`.claude/settings.local.json` instead, and only where git confirms that file is ignored; anywhere else they skip it and
warn. Removing a value removes the key at the next full `desk sync`. A key written by `desk wt new` or
`desk sync <checkout>` and removed from your file before any full sync stays in that checkout.

- Run `desk sync` after an edit, and restart open sessions. `desk settings` says when the desk folder has not caught up.
- `promptCacheTtl` and `subagentPromptCacheTtl` take `5m` or `1h` (Claude Code 2.1.242 or later). `1h` is ignored while a
  subscription draws usage credits. `CLAUDE_CODE_PROMPT_CACHE_TTL` and `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` beat
  these keys, and `desk settings` warns when it sees them.
- `idleCompaction` is a boolean, default true (Claude Code 2.1.290 or later).
- `modelPricing` is not offered: Claude Code honours it in managed settings only.

## Environment variables

| Variable | Read or set by | Meaning |
|---|---|---|
| `AGENT_DESK_SETTINGS` | read by `desk` | The user settings file, instead of `~/.agent-desk/settings.json`. Empty means no file and no warning. |
| `DESK_HOME` | read by the CLI and the mod; set by the shim, `desk sync` settings and `desk stream` | The desk folder. Without it the CLI walks up from the current folder to `desk.config.json`. |
| `CLAUDE_CODE_SESSION_ID` | read by `desk` (board identity, `desk tokens --session self`) | Session identity: its first 8 characters, else `owner`. Subagents share their parent's. |
| `CLAUDE_PROJECT_DIR` | read by `scripts/subagent-context.mjs` | The root whose settings Claude loaded (else the payload's `cwd`). A hook installed for one checkout answers only when the session is inside it. |
| `AGENT_DESK_COLD_GUARD` | read by the mod | `refuse` drops the first send to a cold cache; anything else only warns. |
| `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` | read by Claude Code | `1` turns on the mod's function hooks. |
| `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT` | removed by `desk stream` | Stripped from the stream child's environment, with `CLAUDE_CODE_SESSION_ID`. |

## What is in the kit

| Part | Files |
|---|---|
| Plugin | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json` (registers `./register.ts`) |
| Skills | `kickoff`, `handoff`, `orchestrate`, `decide`, `walkthrough`, the approaches `fix`, `refactor` and `validate`, `stack-lens`, `structure-rubric`, the vendored Ponytail set `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, and Cursor's vendored `thermo-nuclear-code-quality-review` |
| Agents | `implementer`, `reviewer`, `structure-reviewer`, `validator`, `verifier`, `archiver`, `scribe`, `ci-triage` |
| Templates for `desk init` | `templates/AGENTS.md`, `templates/agent-rules.md` |
| JSON Schemas of the desk files | `schemas/desk-config.schema.json`, `schemas/todo.schema.json`, `schemas/board.schema.json`, `schemas/decisions.schema.json` |
| Hook scripts | `scripts/subagent-context.mjs` (session and subagent context), `scripts/edit-guard.mjs` (the edit guard as a `PreToolUse` script), `scripts/friction-scan.mjs [--since <ISO time>] [--json]` (workflow friction in the desk's transcripts: tool errors, denials, oversized outputs, repeated commands; default last 2 hours), `scripts/test.mjs` (what `npm test` runs: every `test/*.test.mjs`, no file list to keep), `scripts/docs-check.mjs [<checkout>]` (no model; runs in `npm test`; compares the README's links, Node version, Commands table with its actions and flags against `bin/desk.mjs` and `lib/`, and `openspec/inventory.md` against the code and the README; prints each gap, exit 1) |

`scribe` (haiku, low effort) writes a branch's CHANGELOG entry, `openspec/inventory.md` rows and README command-table
rows from its diff and edits nothing else; prose that describes behaviour comes back unwritten, listed in its report.
Haiku is unproven on this work: compare its first few runs against Sonnet before relying on it. On Copilot the picker's
model applies instead.

Domain roles come from lenses, not more agents. `stack-lens` holds one short file per stack (`typescript`, `testing`,
`state`, `perf`, `security`, `ui`), each with a build file the `implementer` follows and a review file the `reviewer`
checks; the orchestrator names the lenses in each brief and the agent reads only those. `structure-reviewer` (opus,
medium effort, read-only) runs the `structure-rubric` skill, a 3.5 KB condensed form of Cursor's thermo-nuclear
maintainability rubric (the full vendored skill stays for asking by name), beside the `reviewer` when the change's
kind calls for it (see below), and plans a refactor's target shape. The `orchestrate` table gains `implement-perf`,
`review-structure` and `validate`.

Each change is one kind, and the kind picks its approach (the `orchestrate` skill's Approach by kind table). A **fix**
follows the `fix` skill: Ponytail at level full, a repro or test that fails before and passes after, the root cause
fixed once in shared code. A **refactor** follows the `refactor` skill, which is deliberately aggressive and replaces
Ponytail's smallest-diff and keep-the-structure rules for that run: pin today's behaviour with tests first, plan the
target shape (a `structure-reviewer` run on the paths, for a refactor across several files), delete before adding, migrate every caller and drop the old
path in the same branch, and prove the pinned tests pass unedited with a net reduction in lines and concepts. A
**feature** keeps Ponytail and the lenses. Every non-docs todo carries acceptance claims as notes
(`accept: <claim> | <command> | <expected>`, see the `validate` skill), written at kickoff before any code. After
`desk wt finish`, a `validator` (sonnet, medium) runs beside the `reviewer`, in its own detached copies: it reruns each
claim on the head, and on the base for fix, refactor and perf, and reports VERIFIED, NOT VERIFIED or INCONCLUSIVE per
claim (a feature whose claims CI already runs skips it), and posts `FIXES NEEDED @<head>` when one fails. The merge gate
refuses a head that any `FIXES NEEDED`, `DO NOT MERGE` or `MERGE AFTER FIXES` verdict names, whatever is posted after it,
so a reviewer's `MERGE` beside a failed claim does not merge; the orchestrator posts one more for structure blockers, and
clears a settled or owner-waived claim with `MERGE @<head> overrides: <why>`. Todos carry their kind (`todo set --kind
fix|feature|refactor|perf|docs`); `todo start` and `desk stream` refuse a typed todo other than docs with no `accept:`
note. The kind table in the `orchestrate` skill is the one place the pass triggers are set.

## Specs

Behaviour is specified in [`openspec/specs`](openspec/specs), one capability per folder, in
requirement and scenario form. A change to behaviour goes through [`openspec/changes`](openspec/changes)
(`openspec` CLI: propose, apply, archive). `openspec/inventory.md` lists every command, flag,
variable, config key, hook and written file with the README section that documents it.

## Config reference (`desk.config.json`)

Paths are relative to the desk folder.

```json
{
  "kitVersion": "0.2.0",
  "worktreesDir": "../worktrees",
  "scratchDir": "scratch",
  "harnesses": ["claude", "copilot"],
  "outputStyle": "Concise",
  "permissions": { "allow": [], "deny": [], "ask": [], "additionalDirectories": [] },
  "repos": [
    { "id": "app", "kind": "git", "path": "../app", "gh": "you/app", "defaultBranch": "main",
      "branchPrefix": "agent/", "worktreePrefix": "app-", "install": "npm ci", "build": "npm run build", "check": "npm test" },
    { "id": "tools", "path": "../tools" },
    { "id": "notes", "kind": "folder", "path": "../notes" }
  ]
}
```

| Field | Default | Meaning |
|---|---|---|
| `kitVersion` | written by `init` and `desk sync` | The installed kit version the desk files were last written with. `desk check` warns when it differs from the kit in `node_modules`. |
| `worktreesDir` | `../worktrees` | Where worktrees live. One worktree is `<worktreePrefix><slug>`. |
| `scratchDir` | `scratch` | Stream prompts and logs. |
| `harnesses` | `["claude"]` (`init` writes both) | Which harness files `desk sync` writes. |
| `outputStyle` | `"Concise"` | Claude output style. `desk sync` writes it as `outputStyle` into every `settings.local.json` it writes, so main and headless (`desk stream`) sessions use it, and subagents (which ignore output styles) get a one-line "reply concisely" rule when it is `Concise`. `""` writes nothing and removes an `outputStyle` an earlier sync wrote (one you set yourself stays). Must be a string. |
| `tasks` | `{}` | Model and effort per task id for this desk: `{ "review": { "model": "opus", "effort": "xhigh" } }`. Sits above the kit table and below a user's file. See [User settings](#user-settings). `loadConfig` refuses invalid values. |
| `floor` | `{}` | Per task id minimums, in the same shape as `tasks`. Only raises, whichever layer the value came from. `fable` is refused: not every account has it. Not a security boundary; see [User settings](#user-settings). |
| `permissions` | `{}` | Copied into each Claude `settings.local.json`; `allow`, `deny`, `ask` and `additionalDirectories` are merged with yours as unions. `additionalDirectories` is extended with the desk, `worktreesDir` and every plain folder. |
| `repos[].id` | required | Lowercase letters, digits and dashes. Used by `--repo`, todo areas and board claims. |
| `repos[].path` | required | The main checkout, or the folder. |
| `repos[].kind` | `git` | `git`: worktrees, branches, merges. `folder`: no worktrees. |
| `repos[].gh` | none | GitHub `owner/name` for the CI wait and gate, and the CI column in status. |
| `repos[].defaultBranch` | `main` | The branch that worktrees start from and merge into. |
| `repos[].branchPrefix` | `agent/` | Prefix of each worktree's branch. |
| `repos[].merge` | `direct` | `direct`: `desk wt merge` fast-forwards the default branch and pushes it. `review`: it opens or updates a pull request and a person merges on the server (see [Merge policy](#merge-policy)). `review` needs `kind: git`, a non-empty `branchPrefix` that `defaultBranch` does not start with, `gh` and an `origin`. Any other value is an error. |
| `repos[].worktreePrefix` | `<id>-` | Prefix of each worktree's directory name. An older desk keeps its directory names by setting this, for example `"old-"`. No prefix may start another repo's prefix (`a-` and `a-b-` are refused), so every directory names one repo. |
| `repos[].install`, `repos[].build`, `repos[].check` | empty | Shell command lines run in the worktree. Empty means the step is skipped. |
| `repos[].copy` | empty | Relative paths (no absolute path, no `..`) that `wt new` copies from the main checkout into the worktree before `install` and `build`, also with `--no-build`. A missing path is skipped (with a message). List gitignored paths only; anything else dirties the worktree and `wt finish` refuses it. |

### Many repos, local repos and plain folders

| Entry | Worktrees | Push and fetch | CI | Status shows |
|---|---|---|---|---|
| git repo with `gh` | yes | yes | waited on and gated | the run's result |
| git repo, no `gh` | yes | yes, if `origin` exists | none | `CI -` |
| git repo, no `origin` remote | yes | none | none | `CI -` |
| `kind: "folder"` | none; `wt` refuses | none | none | listed under Roots |

**git repo, no `gh`.** `finish` still runs `check` and pushes, but there is no CI wait. `merge`
skips the CI gate and still pushes.

**git repo, no `origin` remote.** It works as a local-only repo:

- `finish` runs `check` only.
- `merge` fast-forwards the local default branch.
- Branches start from the local default branch.

**`kind: "folder"`.** A plain folder, with or without git. It is:

- listed in the `.code-workspace`
- readable from every checkout (added to `additionalDirectories`)
- usable as a todo area

It gets no settings file.

**Several repos at once:**

- **Slugs are desk-wide.** `wt new` refuses a slug that is already open in another repo. Directory
  names stay `<worktreePrefix><slug>`.
- **`--repo` is required** when a command cannot tell which repo you mean: `wt new` with several git
  repos, or `todo add` with several repos. Other `wt` commands find the repo from the open
  worktree.
- **Board claims** carry `repo`. A claim without it means the first repo. Todo area `repo` (from
  older single-repo desks) also means the first repo.

## Claude Code and GitHub Copilot

`desk sync` writes the Copilot form of the kit's skills and agents into the desk folder's `.github/`
folder. Open the desk folder, or the generated `.code-workspace`, in VS Code.

| Feature | Claude Code | GitHub Copilot (VS Code) |
|---|---|---|
| Desk instructions | `CLAUDE.md` (imports `AGENTS.md`) | `AGENTS.md` |
| Skills (kickoff, handoff, orchestrate, ponytail, ...) | plugin | `.github/skills/<name>/` (copied by `desk sync`) |
| Agents (implementer, reviewer, structure-reviewer, validator, verifier, archiver, scribe, ci-triage) | plugin | `.github/agents/<name>.agent.md`. `model` is dropped (use the picker); `effort` becomes `reasoning-effort`; tools map to Copilot's `read`, `search`, `edit`, `execute`, `web`, `agent`. |
| Ponytail and `agent-rules.md` at session and subagent start (agents that write no code, `reviewer`, `validator`, `verifier`, `structure-reviewer`, `ci-triage`, `scribe`, `archiver` and `Explore`, get the rules only), plus the board at session start | `SessionStart`/`SubagentStart` hooks in `.claude/settings.local.json` | the same hooks: Copilot reads `.claude/settings.json` and `settings.local.json` |
| `desk` CLI: todos, board, status, worktrees, merge gate, decide | yes | yes |
| Desk pane, owner-decisions band, `/desk`, `/decide` | yes (mod) | no (the `decide` skill walks the decisions) |
| Auto-compaction prune, cache warm-hold | yes (mod) | no |
| Edit guard (refuses `sed -i` and heredoc edits) | yes (mod) | no |
| `desk tokens`, running sessions in `desk status` | yes (reads Claude transcripts) | no |
| `desk stream` (headless runs) | yes (`claude -p`) | no |
| [User settings](#user-settings): model and effort, `floor` | applied by `orchestrate` at spawn | advisory: Claude aliases are not Copilot model ids and no per-call effort is documented. `.github/agents` never changes with the user file. |
| [User settings](#user-settings): `cache` | written to `.claude/settings.local.json` | no effect |

The pane, warm-hold, prune, the edit guard, the token report and streams are Claude-only.

**One hook source.** Copilot runs hooks from every source it finds and does not deduplicate them,
so the context hooks live only in `.claude/settings.local.json`. Earlier builds also wrote
`.github/hooks/agent-desk.json`; `desk sync` deletes it. Each hook command is a plain
`node "<path>" <Event>`, because Copilot runs the same `command` under bash and PowerShell. The
script reads either harness's payload (Claude's, or Copilot's PascalCase event with snake_case
fields), finds the desk from the payload's `cwd`, and prints `{}` outside a desk.

**Same-named skills.** `desk sync` replaces `.github/skills/<name>/` and
`.github/agents/<name>.agent.md` for every kit skill and agent name. Give your own skills and agents
in the desk other names. In Claude Code the kit's skills come from the plugin, so they are
namespaced (`agent-desk:handoff`); the `.github/skills` copies keep the plain name (`handoff`) and are
read by Copilot only.

The edit guard refuses `sed -i`, heredoc and `node -e` file edits inside a desk. The mod runs it in
Claude Code. `scripts/edit-guard.mjs` is the same check as a standalone `PreToolUse` hook script
for Bash, if you wire it into another harness yourself. Both do nothing outside a desk.

### VS Code settings

- **The desk folder must be a workspace root.** VS Code finds `.github/skills`, `.github/agents` and
  `.claude/settings*.json` only in the root folders of the workspace. The generated
  `.code-workspace` lists the desk first.
- **Plumbing hidden.** `desk sync` and `desk workspace` add `files.exclude` entries to the desk folder's
  `.vscode/settings.json` for `desk`, `desk.cmd`, `node_modules`, `package.json`, `package-lock.json`,
  `.github`, `.claude` (so `.claude/settings.json` goes with it; set `".claude": false` to show it again; skipped on an older desk whose rules are in `.claude/agent-rules.md`), `.gitignore`, `*.code-workspace` and `NEXT.md.bak`. Your other keys and excludes
  stay, and an exclude you set to `false` shows the file again. It is the desk folder's file, not the
  `.code-workspace`, so the repos keep their `package.json` visible. `.vscode/` is in the `.gitignore`
  `desk init` writes; add it to an older desk's by hand, from a terminal (VS Code now hides `.gitignore`).
- `chat.useCustomizationsInParentRepositories`: turn it on when the desk folder sits inside another
  git repo, so VS Code reads the customizations from the folder you opened and not only the repo
  root.
- `chat.useClaudeHooks`: the older Local harness reads the `.claude/settings*.json` hooks only with
  this on. The Copilot harness reads them by default.
- `github.copilot.chat.skillTool.enabled`: turn it on so agents can load the `.github/skills`.
- Claude-only, with no Copilot equivalent: the Desk pane and band, `/desk`,
  auto-compaction prune, warm-hold, the edit guard, `desk tokens`, running sessions in
  `desk status`, and `desk stream`. The mod's `/decide` is Claude-only too, but `desk sync` copies
  the `decide` skill to `.github/skills`: where AskUserQuestion is not available it prints the
  options and asks for a free answer.

## Versioning and upgrade

- agent-desk uses [semver](https://semver.org). The CLI and the plugin always carry the same
  version.
- [CHANGELOG.md](CHANGELOG.md) lists every release and says what an existing desk must do.

To upgrade:

1. Read the CHANGELOG entries between your `kitVersion` and the new version.
2. Bump the tag in the desk's `package.json`, for example
   `"agent-desk": "github:klintravis/agent-desk#v0.3.0"`.
3. Run `npm install` in the desk.
4. Run `desk sync`. It rewrites the hooks and settings and records the new `kitVersion`. From 0.3.0
   it also migrates the desk once: `NEXT.md`'s rulings go to `decisions.jsonl` and its "Not yet
   verified live" items become `watch` todos (an item naming one open todo, `T-n`, moves that todo to
   `watch` instead and prints the command that moves it back), `NEXT.md` is renamed `NEXT.md.bak` (sync names the
   sections it did not migrate), a generated `TODO.md` is deleted, and the shipped `AGENTS.md` lines
   that named `NEXT.md` or `TODO.md` are replaced. Edit by hand only the lines sync names, then commit.
5. Update the plugin: `/plugin marketplace update agent-desk`.
6. If you use the VS Code extension, install the `.vsix` from the GitHub release: `code --install-extension agent-desk-vX.Y.Z.vsix`.

Until step 4, `desk check` warns that `kitVersion` differs from the installed kit.

**Migrating a hand-rolled desk:** run `desk init` in it (it keeps existing files), fill
`desk.config.json`, then remove your own `SessionStart` and `SubagentStart` context hooks from the
desk's `.claude/settings.json` and from each checkout's settings. `desk sync` writes its own, and
Claude Code and Copilot would otherwise run both.

Development: `npm test` (node:test, no dependencies). `desk check` adds the plugin's own tests and
validation. `npm run typecheck` type-checks `hooks/`, tests included, with `tsc` (settings in `hooks/tsconfig.json`: strict plus `noUncheckedIndexedAccess`) through `npx` against the engine types in `.claude-plugin/types/` (gitignored, written once an interactive `claude --plugin-dir .` session loads the hooks, not by `claude -p`, `claude plugin test` or `claude plugin validate`; or load the plugin-authoring skill (it names the path of its `types/claude-code.d.ts`) and copy that file to `.claude-plugin/types/claude-code/index.d.ts`, creating the folder); the main checkout must hold the file and the repo must list it in `copy` for `wt new` to bring it into a worktree; it exits 1 when they are missing and is not part of `npm test` or `desk check`. Day-to-day work happens in a private development repo (git remote `origin`); this public
repo (git remote `public`) receives one commit per release, on `main`, with its tag. CI (`.github/workflows/ci.yml`) runs once per commit (on push; on pull requests only from forks), `npm test` with Node 22 on
every OS and Node 20 on Linux and, on Node 22 only, `claude plugin test` with a pinned Claude Code CLI installed under the job's temp folder (no API key), on hosted Linux, Windows and macOS here
and on one self-hosted Linux runner in the private repo, where Windows is covered by the check in
`desk wt finish`. No runner is ever registered on this repo: a fork's pull request can edit the
workflow, and it must find nothing of the owner's to run on.

### Releasing

A release is a git tag `v<version>` on `main` plus a GitHub release on the public repo. There is no npm
publish.

1. On a branch, run `node scripts/release.mjs bump <x.y.z>`. It needs `x.y.z` greater than the current
   version and entries under `## Unreleased`; it sets the version in `package.json`,
   `.claude-plugin/plugin.json` and `vscode/package.json` and moves the entries to `## <x.y.z> - <date>`.
2. Review the branch, merge it to `develop`, wait for CI. When the release touches the merge `review` path
   (`desk wt merge` under `merge: "review"`), also run `node scripts/gh-review-live.mjs` from a checkout of the
   private repo. It is a live test of the `gh` calls: it pushes two throwaway branches (`agent/gh-live-base-<id>`,
   `agent/gh-live-head-<id>`, empty commits marked `[skip ci]`), lists PRs for the head, opens a PR between them
   (never against `develop`), updates it, merges it on the server, deletes the head and checks that the merged
   commit is reachable from `pull/<n>/head` (the proof `desk wt merge` uses to close), checking the state each time.
   It then deletes both branches, and closes the PR only if it is still open (a merged PR is not closed), even on
   failure. It refuses an `origin` with more than one push URL, or one that `gh repo view` does not report as private; it prints `ok` and
   exits 0, or `FAILED: ...` and exits 1.
3. Fast-forward `main` to that `develop` commit, push it, tag it and push the tag:
   `git tag vX.Y.Z && git push origin main vX.Y.Z`.
4. With `main` checked out at the tag, run `node scripts/release.mjs publish vX.Y.Z`. It makes one commit
   from the tag's tree on top of the public `main` and pushes it with the tag, so the private history
   stays private. Never push a private branch or tag to `public`.
5. `.github/workflows/release.yml` runs on the tag and skips a private repo. It fails unless the tagged
   commit is on `main`, runs `npm test`, writes the CHANGELOG section to `notes.md`, packages the VS Code
   extension and creates the GitHub release from them, with `agent-desk-vX.Y.Z.vsix` attached.

`node scripts/release.mjs notes vX.Y.Z` prints that section and exits 1 unless the tag is `v` plus the
version in all three files and the CHANGELOG has the section. To create a release by hand after step 4, run
`node scripts/release.mjs notes vX > n.md && gh release create vX --repo klintravis/agent-desk --verify-tag --title vX -F n.md`.

## License

MIT. See [LICENSE](LICENSE). The vendored Ponytail skills keep their own `LICENSE` and
`UPSTREAM.md`. Mod code ported from other MIT mods is listed, with its copyright, in
[THIRD-PARTY.md](THIRD-PARTY.md).
