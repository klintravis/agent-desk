## Why

The NEXT.md migration turns every "Not yet verified live" item into a new `watch` todo, even when the item names a todo (`(T-26)`) that is still open. The desk then holds the work todo and a duplicate watch todo (T-48).

## What Changes

- An item that names exactly one id, whose todo is open (`open`, `active` or `blocked`) and not in area `owner` or `idea`, moves that todo to area `watch` (a record with `area` and the item text as `note`); no new todo.
- An item naming exactly one id whose todo is already in area `watch` adds no new todo; its text is added as a note unless that note is already there (so a second item for one todo is kept, and a re-run writes nothing).
- An item naming a todo that is done, dropped or missing, or naming several ids, keeps today's behaviour: a new `watch` todo. With several ids no single todo is the subject, so moving one would be a guess; a new todo loses nothing.
- Area `owner` is never moved: it would drop an owner decision. Area `idea` is never moved: an idea is not picked up unless the owner promotes it.
- A second run changes nothing: the item's note is already on the todo, and new todos are skipped by their `why` as before.

## Capabilities

### Modified Capabilities
- `desk-sync`: Migrate NEXT.md.
