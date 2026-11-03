# desk-sync Specification

## Purpose

`desk sync` writes the harness files from one source; `desk workspace` writes the VS Code workspace.
Implemented in `lib/sync.mjs`. The harnesses come from `desk.config.json` (`claude`, `copilot`).

## Requirements

### Requirement: Claude settings per checkout
With the `claude` harness, `desk sync` SHALL write `.claude/settings.local.json` in the desk folder and
in every git repo checkout and open worktree, or only in the checkouts named as arguments. Each file
SHALL carry `env.DESK_HOME`, the `permissions` and a non-empty `outputStyle` from `desk.config.json`, and
`SessionStart` and `SubagentStart` hooks running the pinned kit's `scripts/subagent-context.mjs` with the
event, the desk folder and the checkout. Plain folders SHALL get no file.

#### Scenario: Worktree gets its own file
- **WHEN** a worktree is open and `desk sync` runs
- **THEN** its `.claude/settings.local.json` has `DESK_HOME` set to the desk

#### Scenario: Output style
- **WHEN** `desk.config.json` has no `outputStyle`
- **THEN** every file written has `"outputStyle": "Concise"`

#### Scenario: Empty output style
- **WHEN** `outputStyle` is `""`
- **THEN** no `outputStyle` is written, and one that `desk sync` wrote earlier is removed (one it never wrote stays)

#### Scenario: Argument is not a checkout
- **WHEN** an argument has no `.git`
- **THEN** it is skipped with `skip <path>: not a git checkout` and the exit code is 1

### Requirement: Readable directories
The `permissions.additionalDirectories` of every file SHALL list the desk folder, the worktrees
directory and every `kind: "folder"` repo, followed by entries already present, with forward slashes.

#### Scenario: Plain folder is reachable
- **WHEN** the config has a folder repo `notes`
- **THEN** its path is in `additionalDirectories` of each checkout

### Requirement: Carry the desk's own settings
For a checkout (not the desk itself), the desk's `.claude/settings.json` SHALL be carried in: its
permissions are unioned with the config's (the config wins on non-list keys), its `env` merged, its
hooks kept and every other key copied. When that file is not plain JSON the checkout SHALL be left
untouched and a warning printed.

#### Scenario: Carried key
- **WHEN** the desk's `settings.json` sets `autoMode`
- **THEN** each checkout's `settings.local.json` has the same `autoMode`

#### Scenario: Unparseable desk settings
- **WHEN** `.claude/settings.json` has a JSON comment
- **THEN** no checkout file is written, the exit code is 1 and the checkouts keep their guards

### Requirement: Merge, never overwrite
Writing into an existing settings file SHALL keep keys the user added, other env vars, their own
permission entries and their own hooks (also those sharing a hook group with ours). Hook commands that
mention `subagent-context.mjs`, or that equal one of ours, SHALL be replaced rather than duplicated.
Entries the desk wrote last time (recorded in `.claude/synced-permissions.json`) and no longer writes
SHALL be removed. A file that is not plain JSON SHALL be left unchanged with a warning.

#### Scenario: User hook survives
- **WHEN** a user hook shares a `SessionStart` group with the context hook
- **THEN** after sync the user hook is still present and the context hook appears once

#### Scenario: Removed permission goes
- **WHEN** an allow entry is dropped from `desk.config.json`
- **THEN** the next full sync removes it from each checkout

#### Scenario: Local entry stays
- **WHEN** the user added an allow entry by hand
- **THEN** sync keeps it

### Requirement: Local-only settings file
When a checkout has `.git`, sync SHALL add `.claude/settings.local.json` to the clone's own
`info/exclude` (once) and SHALL NOT touch the repo's `.gitignore`.

#### Scenario: Exclude written once
- **WHEN** sync runs twice
- **THEN** the exclude file holds the line once

### Requirement: Records move only on a full sync
`.claude/synced-permissions.json` and `kitVersion` in `desk.config.json` SHALL be updated only by a
sync that had no arguments and no failures. `kitVersion` SHALL become the version of the desk's pinned
kit and sync SHALL print `kitVersion <old|unset> -> <new>` when it changes.

#### Scenario: Partial sync
- **WHEN** `desk sync ../wt` runs
- **THEN** `kitVersion` and the record file are unchanged

### Requirement: Copilot files
With the `copilot` harness, `desk sync` SHALL write, in the desk folder only, each kit skill to `.github/skills/<name>/` and each kit agent to `.github/agents/<name>.agent.md`.

#### Scenario: Skill copy
- **WHEN** a skill was synced before
- **THEN** the old copy is replaced

#### Scenario: Agent file fields
- **WHEN** an agent file is written
- **THEN** `model` is dropped, duplicates among mapped tools are merged, `effort` is written as `reasoning-effort`, and `name` and `description` are JSON-quoted

#### Scenario: Claude settings without the claude harness
- **WHEN** only `copilot` is configured
- **THEN** the desk's `.claude/settings.local.json` is still written
- **AND** a stale `.github/hooks/agent-desk.json` is removed

#### Scenario: Tool mapping
- **WHEN** an agent lists `tools: Read, Grep, Glob, Bash`
- **THEN** its Copilot file lists `read`, `search`, `execute`

#### Scenario: Model dropped
- **WHEN** an agent has `model: sonnet`
- **THEN** its Copilot file has no `model`

### Requirement: Shims
`desk sync` SHALL write `desk` (sh) and `desk.cmd` in the desk folder; each sets `DESK_HOME` and runs
the pinned kit's `bin/desk.mjs` with the arguments. A file of that name without the marker
`written by desk sync` SHALL be left alone with a warning and exit code 1.

#### Scenario: Foreign file
- **WHEN** `desk` exists and lacks the marker
- **THEN** it is not rewritten and a warning names it

### Requirement: Workspace file
`desk workspace` (and `desk sync` when the file exists, and `wt new`/`remove`/`discard`) SHALL write
`<desk folder name>.code-workspace` with the folders `desk`, every repo and one `wt <slug> (<repo>)`
per open worktree, keeping the user's other top-level keys (such as `settings`). A file that is not
plain JSON SHALL be left unchanged with exit code 1.

#### Scenario: Worktree listed
- **WHEN** a worktree `x` of repo `app` is open
- **THEN** the workspace has a folder named `wt x (app)`

#### Scenario: User settings kept
- **WHEN** the workspace file has a `settings` block
- **THEN** it survives the rewrite

### Requirement: Plumbing hidden in VS Code
`desk sync` and `desk workspace` SHALL add `files.exclude` entries set to `true` to the desk folder's `.vscode/settings.json` for `desk`, `desk.cmd`, `node_modules`, `package.json`, `package-lock.json`, `.github`, `.claude`, `.gitignore`, `*.code-workspace` and `NEXT.md.bak`. They SHALL skip `.claude` when the desk keeps its rules at `.claude/agent-rules.md`, and SHALL NOT put the excludes in the `.code-workspace` file.

#### Scenario: Excludes written
- **WHEN** `desk sync` runs and `.vscode/settings.json` is missing
- **THEN** it holds `files.exclude` with the ten entries `true`

### Requirement: VS Code settings kept
For the desk folder's `.vscode/settings.json`, `desk sync` and `desk workspace` SHALL keep every other key and every `files.exclude` entry already present (a `false` included), write nothing when all are present, and leave a file that is not plain JSON unchanged with a warning and without failing the command.

#### Scenario: User choice kept
- **WHEN** the file has another key and `"package.json": false`
- **THEN** both survive and a second run changes nothing

### Requirement: Kit used
The kit copied from SHALL be the desk's `node_modules/agent-desk` when present, otherwise the running kit.

#### Scenario: Unpinned desk
- **WHEN** the desk has no `node_modules/agent-desk`
- **THEN** the hook commands point into the running kit's `scripts/`

### Requirement: Migrate NEXT.md
A sync with no arguments SHALL turn each item of `NEXT.md`'s `## Rulings recorded` section into a `decisions.jsonl` record (`source` `NEXT.md`) and each item of `## Not yet verified live` into an open todo with area `watch` (first 160 characters as title, full text as `why`), then rename `NEXT.md` to `NEXT.md.bak`. A watch item naming exactly one open todo SHALL move that todo to `watch` instead. It SHALL be idempotent and SHALL never overwrite an existing `NEXT.md.bak`.

#### Scenario: Migrated
- **WHEN** a full `desk sync` runs in a desk with `NEXT.md` holding two rulings and one watch item
- **THEN** `decisions.jsonl` gains two records, one `watch` todo is added, `NEXT.md.bak` holds the old file and `NEXT.md` is gone
- **AND** it prints `migrated NEXT.md: 2 rulings, 1 watch todos` and the names of the other sections left in `NEXT.md.bak`

#### Scenario: Item formats
- **WHEN** an item is a `- ` bullet with indented continuation lines, or the section is a paragraph with no bullets, and the file uses CRLF or LF
- **THEN** a bullet and its continuation lines form one item joined with single spaces, and each blank-line-separated paragraph of an unbulleted section is one item

#### Scenario: Ruling fields
- **WHEN** a ruling item is `- Owner, 2026-11-01 (T-40): drop NEXT.md`
- **THEN** its record has `date` `2026-11-01`, `todo` `T-40` and the whole item as `text`
- **AND** an item with no date gets no `date` field

#### Scenario: Watch item names an open todo
- **WHEN** a watch item names only `T-26` and T-26 is open in area `plugin`
- **THEN** T-26 moves to area `watch` with the item as a note, and no new todo is added
- **AND** it prints `moved T-26 to watch; if the item only cites it: desk todo set T-26 --area plugin`, once per moved todo
- **AND** an active or blocked todo moves the same way
- **AND** a second run changes nothing and prints no such line, also when the printed command moved the todo back

#### Scenario: Todo already in watch
- **WHEN** a watch item names only a todo that is already in area `watch`
- **THEN** no new todo is added and the item is added as a note unless that note is already there, so a second item for one todo is kept
- **AND** it prints no moved line, as for a second item for a todo the first item moved

#### Scenario: Other ids
- **WHEN** a watch item names a done, dropped or missing todo, an `owner` or `idea` todo, or several ids
- **THEN** a new `watch` todo is added as for an item with no id

#### Scenario: Second run
- **WHEN** `desk sync` runs again
- **THEN** there is no `NEXT.md`, so nothing is migrated and nothing is printed for it

#### Scenario: Interrupted run
- **WHEN** a run appended the records but did not rename `NEXT.md`, and sync runs again
- **THEN** rulings whose text, cleaned and cut as on write, is already a record's `text`, and watch items whose cleaned text is already a `watch` todo's `why`, are skipped, and `NEXT.md` is renamed

#### Scenario: Backup exists
- **WHEN** both `NEXT.md` and `NEXT.md.bak` exist
- **THEN** nothing is migrated, both files are left, a warning names them and sync exits 1
- **AND** the other writes of that sync (such as `synced-permissions.json`) still happen

#### Scenario: Partial sync
- **WHEN** `desk sync ../wt` runs
- **THEN** `NEXT.md` is untouched

### Requirement: Remove generated TODO.md
A sync with no arguments SHALL delete the desk folder's `TODO.md` only when the kit generated it (it
starts with `# Desk todos` and contains ``Generated from `todo.jsonl` ``), since a desk folder can
itself be a repo with its own `TODO.md`.

#### Scenario: Generated
- **WHEN** a full `desk sync` finds a generated `TODO.md`
- **THEN** it is deleted and `removed TODO.md` is printed

#### Scenario: Hand-written TODO.md
- **WHEN** `TODO.md` lacks the generated header
- **THEN** it is kept and `kept TODO.md: not generated by desk` is printed

#### Scenario: Partial sync leaves it
- **WHEN** `desk sync ../wt` runs
- **THEN** `TODO.md` is untouched

### Requirement: Sections left in the backup
The migration SHALL NOT migrate `NEXT.md` sections other than `## Rulings recorded` and
`## Not yet verified live` (Work, Efficiency notes, Waiting on the owner, free text). They stay in
`NEXT.md.bak`, and the summary line SHALL name each such `## ` section whose body is non-blank, plus
`preamble` when the text before the first `## ` holds more than the `# ` title and one paragraph.

#### Scenario: Other sections named
- **WHEN** `NEXT.md` has a non-blank `## Work`, a non-blank `## Efficiency notes`, an empty `## Waiting on the owner` and a sha paragraph after the intro
- **THEN** the summary ends with `(NEXT.md.bak keeps: preamble, Work, Efficiency notes)`
- **AND** none of their text is written to `decisions.jsonl` or `todo.jsonl`

### Requirement: Migrated sections named when partly kept
A migrated section SHALL be named in the migration summary too when a non-blank line in it was not migrated (a lead-in line, a
second paragraph, a subheading) or an item was cut at 1000 characters.

#### Scenario: Migrated section partly kept
- **WHEN** a migrated section holds a non-blank line that was not migrated, or an item was cut at 1000 characters
- **THEN** the summary names that section

### Requirement: Ruling todo from the prefix
A ruling's `todo` SHALL come only from the `Owner, <date> (T-<n>):` prefix `desk decide` writes.

#### Scenario: Prefix only
- **WHEN** a migrated ruling item has no `Owner, <date> (T-<n>):` prefix
- **THEN** its `todo` is not taken from any other text

### Requirement: Patch AGENTS.md
A sync with no arguments SHALL replace each line of the desk's `AGENTS.md` that is identical
(trailing `\r` ignored) to a line of a shipped `templates/AGENTS.md` naming `NEXT.md` or `TODO.md` with
the matching line of the current template, keeping the file's line endings. A line that names
`NEXT.md` or `TODO.md` and is not a shipped line SHALL be left as is and named for a hand edit. The
patch SHALL be idempotent.

#### Scenario: Unchanged line patched
- **WHEN** the desk's `AGENTS.md` holds the shipped line ``**Start every session by reading `NEXT.md`** (shared state: rulings, not verified live) and``
- **THEN** a full `desk sync` replaces it with the current template's line, which names `desk decide --list`
- **AND** prints `patched AGENTS.md: <n> lines`

#### Scenario: Edited line kept
- **WHEN** a line of `AGENTS.md` names `NEXT.md` but differs from every shipped line
- **THEN** it is left byte for byte and sync prints `AGENTS.md:<line> names NEXT.md/TODO.md: edit by hand`

#### Scenario: Second run
- **WHEN** `desk sync` runs again after a patch
- **THEN** `AGENTS.md` is unchanged and nothing is printed for it

#### Scenario: Partial sync leaves it
- **WHEN** `desk sync ../wt` runs
- **THEN** `AGENTS.md` is untouched

### Requirement: User layer never committed
The user file SHALL have no effect on any file git tracks or could commit. `desk sync` and `desk wt new` SHALL write user values only as the `cache` keys in `.claude/settings.local.json`, and `.claude/synced-permissions.json` SHALL hold their names only. `syncCopilot` SHALL NOT read the user file.

#### Scenario: Nothing to commit after a sync
- **WHEN** a desk with the `claude` and `copilot` harnesses, its repo and a worktree are synced and committed, a user file with distinctive `tasks` and `cache` values is added, and `desk sync` runs again
- **THEN** `git status --porcelain` is empty in the desk, the repo and the worktree
- **AND** `.claude/settings.local.json` in each holds the `cache` values

#### Scenario: Copilot files identical
- **WHEN** `desk sync` runs with and without a user file
- **THEN** `.github/agents/*.agent.md` and `.github/skills/` are byte-identical
- **AND** the `model` and `reasoning-effort` of each agent file come from kit frontmatter

#### Scenario: Task values written nowhere
- **WHEN** a user file sets `tasks` and `desk sync` runs
- **THEN** no file written by the sync holds them

#### Scenario: Record holds names only
- **WHEN** a full sync writes user cache keys
- **THEN** `.claude/synced-permissions.json` lists the key names under `user`, apart from what the desk carries, and none of the values

### Requirement: User cache keys in local settings
`desk sync` and `desk wt new` SHALL overlay the user file's `cache` keys on the keys written to `.claude/settings.local.json` of the desk folder, each checkout and each worktree, above the desk's carried keys. They SHALL do so only where `git check-ignore` reports the file ignored or the folder is not in a git work tree. A malformed user file SHALL write nothing from the user layer and SHALL NOT fail the sync.

#### Scenario: User beats the desk
- **WHEN** the desk's `.claude/settings.json` sets `promptCacheTtl` to `1h` and the user file sets `5m`
- **THEN** each `.claude/settings.local.json` holds `5m`
- **AND** the desk's `.claude/settings.json` is unchanged

#### Scenario: Other keys kept
- **WHEN** a `.claude/settings.local.json` holds a key the user added by hand
- **THEN** that key survives the overlay

#### Scenario: Value removed
- **WHEN** a key is removed from the user file and a full `desk sync` runs
- **THEN** a checkout's file holds the desk's carried value, or no key if the desk has none
- **AND** the desk folder's file holds no such key, so its `.claude/settings.json` applies again

#### Scenario: Partial sync
- **WHEN** `desk sync <path>` runs
- **THEN** the user's cache keys are written to that path and the record file is unchanged

#### Scenario: Tracked settings file
- **WHEN** a repo tracks `.claude/settings.local.json`
- **THEN** no user value is written to that file and a warning names it
- **AND** the rest of the sync proceeds

#### Scenario: Tracked key outlives the user's name
- **WHEN** a repo's tracked `.claude/settings.local.json` holds a key, the record lists that name from the user file, and the key is removed from the user file or its `cache` is emptied
- **THEN** the next full `desk sync` leaves the key in that file and `git status --porcelain` empty there
- **AND** the key leaves a checkout's ignored file

#### Scenario: Malformed user file
- **WHEN** the user file does not parse and `desk sync` runs
- **THEN** it warns, writes the carried keys as usual and exits as it would without the file

### Requirement: Deny config edits under review
With the `claude` harness, when any repo has `merge: "review"`, `desk sync` SHALL add permission rules to `permissions.deny` in the settings files it writes, denying Claude's file-edit tools on the desk's `desk.config.json`. When no repo has it, the rules SHALL be absent.

#### Scenario: Review repo present
- **WHEN** `desk sync` runs on a desk with a `review` repo
- **THEN** each written `.claude/settings.local.json` denies the file-edit tools on that file, and the desk's own permissions are kept

#### Scenario: Switching back
- **WHEN** the last `review` repo returns to `direct` and `desk sync` runs
- **THEN** the rules are gone and the user's own rules are kept

#### Scenario: Direct desk
- **WHEN** every repo is `direct`
- **THEN** the written files are the same as before this requirement

### Requirement: Sync output under review
`desk sync` SHALL print one line per `review` repo naming the policy, the deny, and that the default branch needs protecting on the server. It SHALL print no such line for a `direct` repo.

#### Scenario: One review repo
- **WHEN** a desk has one `review` repo and one `direct` repo
- **THEN** one `merge` line is printed, for the `review` repo
