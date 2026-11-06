## Why

The "Tracked settings file" scenario of "User cache keys in local settings" says a warning names the file, with no harness condition. The code warns only with the `claude` harness: the cache keys are Claude Code's, a Copilot-only desk gets none (T-87), so there is nothing to warn about. The code is right; the spec is corrected (todo T-170). The warning on a repo was already asserted on `desk sync` stderr; the new coverage is its absence on a Copilot-only desk, the desk-folder path and "exactly once". `desk settings` reports the same warning, so its requirement gets the same condition.

## What Changes

- The scenario names the `claude` harness; a new scenario says a Copilot-only desk prints no warning.

## Capabilities

### Modified Capabilities
- `desk-sync`: "User cache keys in local settings".
- `desk-cli`: "Settings warning for an unignored local file".
