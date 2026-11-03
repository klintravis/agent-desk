## Why

The sidebar shows one piece of work three times (Active todos, Branches, Claims), as raw CI text and slugs. The owner asked for a professional, colourful view with no duplicated information (T-149).

## What Changes

- One `Work` section replaces `Active todos`, `Branches` and `Claims`: one row per piece of work, joined on slug, with a status icon and theme colour (green ready, yellow waiting, red failing, blue active).
- `Running sessions` shows title and agent count, agents as children, no slugs; unreadable transcripts show `unavailable`, not `(0)`.
- Empty sections are hidden; an all-empty status shows `Nothing active`. `Owner decisions` gets a distinct icon; `Overlaps` a warning icon.

## Capabilities

### Modified Capabilities
- `vscode-extension`: the status view.

## Decisions

- Still a native tree (T-87); `desk.js` returns icon and colour names, `extension.js` maps them to `ThemeIcon` and `ThemeColor`.
- Green needs CI success on the head and a `MERGE` verdict whose sha is the head (the merge gate's rule); a verdict for an older head is shown as `(old head)` and never counts. CI success without that verdict is yellow.
