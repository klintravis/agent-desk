## Why

Findings 7-12 of the redaction review (T-234), each confirmed by running it on `develop` first. A vendor key as a URL password got a placeholder inside a placeholder, and the inner one never came back in a tool call, since restore is single-pass. `DB_PASS=` and `--password <value>` with a space left the value raw. A URL user holding `@` left the password raw, and so did every host after the first in a multi-host URL. On the other side, a PR body quoting a masked URL was refused because the placeholder read as a password.

## What Changes

- URL passwords are masked before vendor shapes, so a password that holds a vendor key gets one placeholder.
- A URL password that is exactly one placeholder (`SECRET`, `EMAIL` or `IP`, eight lower-case hex digits) is kept and not refused. Anything else in that slot still counts as a password: a placeholder with text before or after it, another kind, another length, upper-case hex.
- `pass` counts as a key's name, alone or with `db`, `pg`, `sql`, `user`, `root` or `admin` before it, with a left edge so `bypass`, `compass` and `surpass` do not count. After a letter or digit and `_`, `.` or `-` (`DB_PASS=`), or after `--` (`--pass=`), it is a password's name; joined (`PGPASS=`, `dbPass:`) or bare (`PASS=`) a key's name only. `pass:` right after a letter and one space or tab stays out, as a sentence (`all tests pass: <sha>`); `pass=` always counts.
- `--password`, `--passwd`, `--pwd` and `--pass` followed by a space or tab count as a name, with the password rules beside them: `--password-file`, `--password-stdin`, `--pass-through`, a path, `$VAR`, `<password>` and words such as `must be set` keep passing.
- The user before a URL password may hold `@`. After a user holding `@`, digits and then `,`, `?` or `#` read as a port, so `mongodb://a@h1:27017,b@h2:27017/db` and `https://me@host:8443?to=a@b` keep passing.
- Each later host of a comma-separated URL is walked for its own password, whatever the first one was. `hasSecret` now uses the same walk as the scrubber.
- Known cost, more refusals: `DB_PASS=`, `PASS=`, `--password <value>`, a URL user holding `@` and later hosts of a multi-host URL are refused where they passed before. `pass: <sha>` is refused, like `key: <sha>`, unless a letter and one space or tab come right before it, so `CI: pass: <sha>`, `209 pass: <sha>` and `tests  pass: <sha>` are refused too. `tests pass=<key-shaped value>` is refused. So is a multi-host URL with a later host's port and an `@` in its query.
- Not closed, each with a `shortcut:` comment: `-p <value>`, `-p<value>` and single-dash `-password <value>` (`mkdir -p`, `ssh -p 22`); another joined spelling such as `mysqlpass`; `user pass: <value>`; a password of digits and then `,`, `?` or `#` after a user holding `@`; a later host's password after a host with a user and no password; more than 64 hosts or a host of more than 260 characters; a later password holding both `,` and `:` is hidden only after its last comma; a password of 1 or 2 characters, and every later password after it; a value holding marks beside a joined or bare name (`PGPASS=`, `dbPass:`, `PASS=`).
- Not changed: rulings T-214, T-232 and T-235. A slashed value beside a name stays as it is, and an object-store path stays refused.

## Capabilities

### Modified Capabilities
- `secret-redaction`: "What counts as a secret", "Template passwords", "Refusal check".
