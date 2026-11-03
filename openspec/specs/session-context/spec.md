# session-context Specification

## Purpose

What every session and subagent is told at start (`scripts/subagent-context.mjs`) and the guard against
shell-scripted file edits (`hooks/editguard.mjs`, `scripts/edit-guard.mjs`, and the `tool.call` hook in
`hooks/register.ts`).

## Requirements

### Requirement: Hook output
`subagent-context.mjs` SHALL print one JSON object whose `hookSpecificOutput` carries `hookEventName`
(`SessionStart` or `SubagentStart`) and `additionalContext`, and exit 0. The event SHALL be the first
argument, else the payload's `hook_event_name`, else `SubagentStart`.

#### Scenario: Subagent start
- **WHEN** the hook runs for `SubagentStart` in a desk
- **THEN** `additionalContext` begins `PONYTAIL MODE ACTIVE - level: full`

### Requirement: Ponytail for every agent
The context SHALL contain the body of the kit's `skills/ponytail/SKILL.md` with its front matter removed
and the table rows for the `lite` and `ultra` levels dropped. Every agent role, including read-only
ones such as reviewers and verifiers, SHALL receive it.

#### Scenario: Reviewer gets Ponytail
- **WHEN** a `SubagentStart` fires for any agent
- **THEN** the same Ponytail text is delivered

#### Scenario: Levels trimmed
- **WHEN** the context is built
- **THEN** it has no row starting `| **lite**` or `| **ultra**`

### Requirement: Desk rules
The context SHALL append the desk's `agent-rules.md` (in the desk folder, else `.claude/agent-rules.md`)
and a closing line telling the agent how to run the desk command by absolute path (`desk` in bash,
`desk.cmd` in PowerShell or cmd), not `npx desk`.

#### Scenario: Old location
- **WHEN** only `.claude/agent-rules.md` exists
- **THEN** its content is used

### Requirement: Board only for sessions
For `SessionStart` the context SHALL also hold the board summary and, per repo, the desk area and
owner decisions, the next open todo (or `nothing open`) and the ids of waiting owner decisions. For
`SubagentStart` it SHALL NOT.

#### Scenario: Fresh reviewer is blind to the board
- **WHEN** `SubagentStart` fires
- **THEN** the context has no `Desk board` section

### Requirement: Which desk
The desk SHALL be `DESK_HOME`, else the desk argument, else found from the payload's `cwd` (or the
current directory). When a checkout argument is given and the session's directory (`CLAUDE_PROJECT_DIR`,
else the payload `cwd`) is outside it, the hook SHALL stay silent so only the checkout holding the
session answers.

#### Scenario: Other checkout
- **WHEN** the hook is installed for checkout A and the session runs in B
- **THEN** it prints `{}`

### Requirement: Never blocks
Outside a desk, or when `skills/ponytail/SKILL.md` cannot be read, the hook SHALL print `{}` and exit 0.
A board failure SHALL leave the rest of the context intact.

#### Scenario: Outside a desk
- **WHEN** no desk can be found
- **THEN** the output is `{}` and the exit code 0

### Requirement: Edit guard verdict
`verdict(command)` SHALL return a reason for a Bash command that edits files with `sed -i` or
`sed --in-place` in command position (start, or after `;`, `&`, `|` or `xargs`), a heredoc written into a
file (`cat > f <<`, `<<EOF >> f`), a python script that writes or reads stdin from a heredoc, or
`node -e` with `writeFileSync` (except for `settings.local.json` and `worktree-settings`); otherwise it
SHALL return null. Text that merely mentions `sed -i` inside a quoted string SHALL pass.

#### Scenario: sed in place
- **WHEN** the command is `sed -i 's/a/b/' x.ts`
- **THEN** the verdict is `sed -i`

#### Scenario: Mention is allowed
- **WHEN** the command is `echo "blocked a sed -i test" >> log.md`
- **THEN** the verdict is null

#### Scenario: Commit message heredoc
- **WHEN** the command is `git commit -F - <<'EOF' ...`
- **THEN** the verdict is null

### Requirement: Edit guard denial
A blocked command SHALL be denied with the reason `Desk rule: no <kind> for file edits ... Use the Edit
tool (or Write for a new file) instead.` Both the plugin's `tool.call` hook (Bash tool, in a desk only)
and `scripts/edit-guard.mjs` (a PreToolUse settings hook, inert outside a desk, `--self-test` available)
SHALL apply it. Both SHALL fail open on an internal error.

#### Scenario: Plugin hook
- **WHEN** a Bash call in a desk runs a blocked command
- **THEN** the call is denied with the desk-rule message

#### Scenario: Outside a desk
- **WHEN** the session is not in a desk
- **THEN** no command is denied

### Requirement: Concise reply rule for subagents
Output styles do not reach subagents, so for `SubagentStart`, when the desk's `outputStyle` is `Concise`, the context SHALL end its rules with `- Reply concisely: lead with the result, no preamble or recap; keep full detail in errors, failing output and security findings.` For `SessionStart`, or any other style, it SHALL NOT.

#### Scenario: Subagent in a Concise desk
- **WHEN** `SubagentStart` fires and `outputStyle` is unset or `Concise`
- **THEN** the context contains the line

#### Scenario: Session start
- **WHEN** `SessionStart` fires
- **THEN** the context does not contain the line (the session's own output style applies)

### Requirement: Merge guard verdict
A shell command SHALL get a refusal verdict only when, in a repo with `merge: "review"`, it would push to, delete or merge into a branch outside that repo's `branchPrefix`, or when it is `gh pr merge`. An explicit tag ref is not a branch and SHALL be allowed. The rule SHALL live in a pure, Node-free module with a self-test table, and SHALL honour quoted text.

#### Scenario: Agent branches pass
- **WHEN** the command is `git push origin agent/x`, with or without `-u` or `--force`, or `git push origin agent/main`, and the prefix is `agent/`
- **THEN** it is allowed

#### Scenario: Refspecs and forms that reach a protected branch
- **WHEN** the command is `git push origin HEAD:main`, `agent/x:main`, `+HEAD:refs/heads/main`, `:main`, `--delete main`, `--all` or `--mirror`
- **THEN** it is refused

#### Scenario: Tag pushes pass
- **WHEN** the command is `git push origin refs/tags/v1.2`, `git push origin HEAD:refs/tags/v1.2`, `git push --tags` or `git push origin --tags`
- **THEN** it is allowed

#### Scenario: A bare short name stays refused
- **WHEN** the command is `git push origin v1.2`, and `v1.2` is outside the prefix
- **THEN** it is refused, because a short name cannot be told from a branch, and the reason names `refs/tags/v1.2` as the form that passes

#### Scenario: A branch beside --tags
- **WHEN** the command is `git push origin main --tags`
- **THEN** it is refused, because `main` is outside the prefix

#### Scenario: gh pr merge
- **WHEN** the command is `gh pr merge`, in a `review` repo
- **THEN** it is refused

#### Scenario: Other directories and chains
- **WHEN** the push is reached through `git -C <dir>`, `cd <dir> &&` or a chain of commands
- **THEN** the branch and the repo are read for that directory and that part of the chain

#### Scenario: No refspec
- **WHEN** the command is `git push`, `git push origin` or `git push origin HEAD`
- **THEN** the current branch of the directory decides, and a detached head is allowed

#### Scenario: Merge
- **WHEN** the command is `git merge <anything>` and the current branch is outside the prefix
- **THEN** it is refused, except `--abort` and `--quit`

#### Scenario: Updating an agent branch
- **WHEN** the command is `git merge origin/main` on `agent/x`
- **THEN** it is allowed

#### Scenario: Quoted text
- **WHEN** the command is `git commit -m "git push origin main"`
- **THEN** it is allowed

### Requirement: Merge guard scope
The guard SHALL find the desk with `findDesk` and map a command's directory to a repo through its git common directory. It SHALL refuse only on a `review` repo. It SHALL run as a plugin hook on the `Bash` and `PowerShell` tools and as a script taking the PreToolUse JSON, and SHALL be the same logic in both.

#### Scenario: Direct desk
- **WHEN** no repo of the desk is `review`
- **THEN** every command is allowed and no git process is started

#### Scenario: Mixed desk
- **WHEN** a desk has a `review` repo and a `direct` repo
- **THEN** `git push origin main` is refused in the first, in its worktrees too, and allowed in the second

#### Scenario: Unknown repo
- **WHEN** the directory's repo is not listed in the desk's config
- **THEN** the command is allowed

### Requirement: Merge guard fails open
Any error in the guard SHALL allow the command. The denial SHALL say why, and SHALL name `desk wt merge` and that a person merges on the server.

#### Scenario: Unreadable config
- **WHEN** `desk.config.json` cannot be parsed, or git fails
- **THEN** the command is allowed

#### Scenario: Denial text
- **WHEN** a command is refused
- **THEN** the reason names the protected branch and `desk wt merge`
