## Why

Every change ran under the same rules: Ponytail's smallest diff, which is right for a correction and wrong for an intentional restructure, and a review that judged code without anyone independently running what the change claims. The owner wants corrections kept tight, refactors allowed to be aggressive, and testing and validation built into the flow.

## What Changes

- Approach skills `fix` and `refactor` (from pstack's bug-fix and refactoring playbooks) and an Approach by kind table in `orchestrate`.
- `structure-reviewer` plan mode, which gives a refactor its target shape.
- Acceptance claims as `accept:` todo notes written at kickoff; skill `validate` and agent `validator` (from cursor-team-kit's `verify-this`) that prove them on base and head beside the reviewer; merge only when every claim is VERIFIED.
- `implementer` follows the approach and runs the claims; `reviewer` checks the approach's Done when list; `agent-rules.md` template names the refactor override.

## Capabilities

### Modified Capabilities
- `agents`: approaches and the validator.
