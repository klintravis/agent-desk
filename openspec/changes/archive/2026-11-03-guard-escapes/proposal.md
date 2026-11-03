## Why

The merge guard does not see a push hidden by bash `$'...'` escapes (`git pu$'\x73'h origin main`), and the hook's word test does not even start it for one. It also misses PowerShell assignment forms that run their right side: `$a += git push origin main`, `$a=$b=git push origin main`, `$a, $b = git push origin main`.

## What Changes

- The guard's parser decodes `$'...'` as bash does (hex, octal, unicode, control and plain escapes). The decoded text stays one word of data and is not read again as shell.
- The hook's word test also passes any command with a backslash after a `$'`, so the script starts for an escaped push.
- The parser drops PowerShell assignment targets at the operator: any of `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `??=`, chained, with one or more comma-separated targets, spaced or glued. What follows is read as a command.
- The fail direction changes for a command the parser cannot read: when it names `push` or `merge` it is refused on any desk with a `review` repo, wherever it is typed, since a `cd` in it is unread too. A parser miss such as `echo ${x:-'}'}; git push origin main` was a bypass; one that leaves no quote open, `echo ${x:-'}'}; git push origin main #'`, still is, and is listed as not covered. Errors in git, the config or the hook's input still allow.
- An unreadable heredoc body line stays unseen, since prose has apostrophes; the README lists that gap.

## Capabilities

### New Capabilities

### Modified Capabilities
- `session-context`: `Merge guard verdict` covers `$'...'` escapes, PowerShell assignment forms and unreadable lines; `Merge guard scope` and `Merge guard fails open` carve the unreadable line out.

## Impact

`hooks/mergeguard.mjs` (`scan`, `parse`, `judge`, `mentions`, the `CASES` table), `scripts/merge-guard.mjs`, `test/merge-guard.test.mjs`, `README.md` (the "not covered" list), `CHANGELOG.md`. No config or upgrade step.
