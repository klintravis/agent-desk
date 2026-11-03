## MODIFIED Requirements

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
- **AND** an active or blocked todo moves the same way
- **AND** a second run changes nothing

#### Scenario: Todo already in watch
- **WHEN** a watch item names only a todo that is already in area `watch`
- **THEN** no new todo is added and the item is added as a note unless that note is already there, so a second item for one todo is kept

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
