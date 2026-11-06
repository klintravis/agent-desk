## Why

`tasks.review.modle` or a misspelt repo key loaded silently and did nothing (T-239), the gap T-232 closed for `harnesses` and `floor`.

## What Changes

- BREAKING: `loadConfig` refuses a key `schemas/desk-config.schema.json` does not list (top level, `repos[]`), a key other than `model` and `effort` in a `tasks` entry, and a non-object `tasks`, `tasks` entry, `repos` entry or file.
- The allowed keys are read from the schema; it gains `$schema` and its "other keys are allowed" note goes.

## Capabilities

### Modified Capabilities
- `desk-config`: new requirement "Unknown keys refused".
