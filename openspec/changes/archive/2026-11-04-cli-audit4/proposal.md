## Why

An audit (T-233) found hand-edited lines and odd arguments crashing the CLI: `board post --repo x claim foo` read `--repo` as the kind; a `null` line in `board.jsonl`, a todo note with no `ts` or a numeric todo id made readers exit 1, against the "never breaks a reader" promise; `desk init` with a repeated repo id wrote files and then failed, failed on a `package.json` with a BOM, crashed on `--harness` with no value, and said nothing when an existing `.gitignore` lacked the desk's lines; `desk status` listed a task as "floor raised" for a user file that never set it.

## What Changes

- `board`: `--repo <id>` is removed from the whole argument list before the command is read.
- JSONL readers keep only objects; `fold` skips a non-string id; a note line without `ts` folds; `tally` skips a `null` line.
- `init`: a repeated repo id and `--harness` without a value are usage errors before any write; `package.json` is read with the BOM-tolerant parser; an existing `.gitignore` is kept and a warning names the lines it lacks.
- `desk status`: "floor raised" lists only values the user file set.
- `hooks/prune.ts`: `HEAD` is no longer exported (no importer).

## Capabilities

### Modified Capabilities
- `todos-and-board`: "Append-only JSONL files", "Board kinds and posting".
- `desk-init`: "Repo entries", "Flags", "Never overwrite".
- `user-settings`: "Floor and order".
- `desk-cli`: "User layer on the status screen".
