## MODIFIED Requirements

### Requirement: Edit guard verdict
`verdict(command)` SHALL judge each command segment of a shell command on its own. Segments are split on `;`, `&`, `|`, parentheses and newlines outside quotes, after dropping `#` comments and joining a backslash at the end of a line with the next line; heredoc bodies SHALL NOT count as commands, but SHALL count as the script of an interpreter in that segment, and the string of `bash -c` (or `sh`, `zsh`) SHALL be judged as a command of its own. It SHALL return a reason for a segment that edits files with `sed -i` or `sed --in-place` (the flag anywhere among the unquoted arguments, `sed` in command position: at the segment's start, or after `do`, `then`, `else`, `if`, `elif`, `while`, `until`, `sudo`, `env`, `command`, `exec`, `time`, `!`, `{`, a variable assignment or `xargs` with flags), a heredoc written into a file (`cat > f <<`, `<<EOF >> f`), `python`, `python3` or `py` that reads stdin from a heredoc (`python - <<`) or runs `-c` with a script that writes, or `node` with `-e` or `--eval` and `writeFileSync` (except for `settings.local.json` and `worktree-settings` in that segment); otherwise it SHALL return null. The interpreter's name SHALL count only outside quotes. Text that merely mentions any of these inside a quoted string, including a commit message, SHALL pass.

#### Scenario: sed in place
- **WHEN** the command is `sed -i 's/a/b/' x.ts`
- **THEN** the verdict is `sed -i`

#### Scenario: sed in place, other forms
- **WHEN** the command is `sed -E -i 's/a/b/' f`, `for f in *; do sed -i 's/a/b/' $f; done`, an indented `  sed -i 's/a/b/' f` on its own line, or `(sed -i 's/a/b/' f)`
- **THEN** the verdict is `sed -i`

#### Scenario: Other interpreter spellings
- **WHEN** the command is `py -c "open('a','w')"` or `node --eval "require('fs').writeFileSync('a','b')"`
- **THEN** the verdict names a python or node edit script

#### Scenario: A separator inside the script
- **WHEN** the command is `python -c "import os; open('a','w')"`
- **THEN** the verdict is `python edit script`

#### Scenario: The script in a heredoc
- **WHEN** the command is `python -c "$(cat <<'EOF' ...`, with a body that holds `open('a','w').write('x')`
- **THEN** the verdict is `python edit script`

#### Scenario: Apostrophe in a comment
- **WHEN** the command is `# don't touch the header`, then on the next line `sed -i 's/a/b/' f`
- **THEN** the verdict is `sed -i`

#### Scenario: Edit-looking comment
- **WHEN** the command is `# avoid (sed -i here)`, then on the next line `git status`
- **THEN** the verdict is null

#### Scenario: Continued line
- **WHEN** the command is `node -e \`, then on the next line `"require('fs').writeFileSync('a','b')"`
- **THEN** the verdict is `node -e edit script`

#### Scenario: Harmless call beside an edit-looking word
- **WHEN** the command is `python -c "print(1)" && git commit -m "rewrite x"` or `node -e "console.log(1)" && grep writeFileSync x`
- **THEN** the verdict is null

#### Scenario: Mention is allowed
- **WHEN** the command is `echo "blocked a sed -i test" >> log.md` or `grep -E "a|sed -i|b" f`
- **THEN** the verdict is null

#### Scenario: Commit message heredoc
- **WHEN** the command is `git commit -F - <<'EOF' ...`, with a body line that starts with `sed -i`
- **THEN** the verdict is null

#### Scenario: PowerShell here-string
- **WHEN** the command is a `git commit -m @'...'@` whose text holds an apostrophe and `; sed -i`
- **THEN** the verdict is null

### Requirement: Edit guard denial
A blocked command SHALL be denied with the reason `Desk rule: no <kind> for file edits ... Use the Edit
tool (or Write for a new file) instead.` Both the plugin's `tool.call` hook (Bash and PowerShell tools, in a desk only)
and `scripts/edit-guard.mjs` (a PreToolUse settings hook, inert outside a desk, `--self-test` available)
SHALL apply it. Both SHALL fail open on an internal error.

#### Scenario: Plugin hook
- **WHEN** a Bash or PowerShell call in a desk runs a blocked command
- **THEN** the call is denied with the desk-rule message

#### Scenario: Outside a desk
- **WHEN** the session is not in a desk
- **THEN** no command is denied
