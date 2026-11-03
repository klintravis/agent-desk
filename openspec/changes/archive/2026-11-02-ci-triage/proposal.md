## Why

Red CI runs go to a `general-purpose` agent on Haiku, which has every tool and no set report or rule about log text. A dedicated read-only agent is cheap, reports the same three facts each time and treats CI log text as untrusted data (T-94).

## What Changes

- New agent `agents/ci-triage.md` (`haiku`, `low`; tools `Read`, `Grep`, `Glob`, `Bash`): takes a run id or a slug, returns the failing step, the failing test and the first error, and fixes nothing.
- The `orchestrate` skill sends CI logs to it. A long check output with no CI run stays with `general-purpose`, since this agent reads runs only.
- `desk sync` needs no code: it writes every file in `agents/`, so Copilot gets `.github/agents/ci-triage.agent.md`.
- No new option or config.

## Capabilities

### New Capabilities
- `kit-agents`: what the kit's `ci-triage` agent may do and what it reports.
