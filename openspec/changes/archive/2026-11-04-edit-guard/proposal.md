## Why

The edit guard ran on the Bash tool only, though PowerShell is the main shell on Windows, so `node -e` with `writeFileSync` through PowerShell passed. It also missed common forms (`sed -E -i`, `for ...; do sed -i`, an indented `sed -i`, `(sed -i ...)`, `py -c`, `node --eval`) and judged the whole line, so a harmless `python -c "print(1)" && git commit -m "rewrite x"` was refused (T-211).

## What Changes

- The plugin's `tool.call` guard also runs on the PowerShell tool.
- `verdict` judges each command segment (split on `;`, `&`, `|`, parentheses and newlines outside quotes), not the whole line. Heredoc bodies and quoted text are never commands.
- `sed` with an in-place flag anywhere among its unquoted arguments is refused, after `do`, `then`, `sudo`, `xargs` with flags and the like. `py` counts as python, `--eval` as `-e`, and the string of `bash -c` is judged as a command of its own.
- `scripts/edit-guard.mjs` needs no code change (it reads `tool_input.command`); a hand-wired entry needs the matcher `Bash|PowerShell`.

## Capabilities

### Modified Capabilities
- `session-context`: requirements "Edit guard verdict" and "Edit guard denial".
