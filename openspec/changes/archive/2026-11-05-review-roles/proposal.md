## Why

The desk's review checked correctness, safety and leanness but had no strict structural pass, and the implementer and reviewer had no stack-specific rules. Cursor's thermo-nuclear review and Lauren Tan's pstack (github.com/cursor/plugins, MIT) cover both. Taking them as more agents per stack would multiply near-identical prompts; lenses keep one agent per job and load only the rules a change needs.

## What Changes

- Vendored skill `thermo-nuclear-code-quality-review` (one line dropped so agents can load it) and a read-only agent `structure-reviewer` that runs it beside the `reviewer` on large changes and refactors, with no verdict of its own.
- Skill `stack-lens` with lenses `typescript`, `testing`, `state`, `perf`, `security`, `ui`.
- `orchestrate`: task ids `implement-perf`, `refactor`, `review-structure`; a Stack lenses section; the review step runs both reviewers in parallel and merges their lists.
- `implementer`: data shape first, the 1000-line limit, a failing test before a bug fix, a self-deslop pass. `reviewer`: devex breaks, feature-gate leaks, the 1000-line limit, no unfinished research, PR threads read after its own pass (from thermos' `thermo-nuclear-review`).

## Capabilities

### Modified Capabilities
- `agents`: the structure reviewer and stack lenses.
