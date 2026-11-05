---
name: structure-rubric
description: >-
  The desk's condensed structural review rubric, used by the `structure-reviewer` agent: code-judo
  simplifications, spaghetti branching, files pushed past 1000 lines, wrong layer, muddy types,
  non-atomic flow. A shorter form of the vendored `thermo-nuclear-code-quality-review` skill with the
  same standards and bar. Use for a structural or maintainability review of a branch.
---

# Structure rubric

Judge whether the change leaves the code simpler or messier, and be ambitious about it. Look for the
"code judo" move: a restructure that keeps the behaviour and makes whole branches, helpers, modes, flags or
layers disappear, so the result feels inevitable. A cleaner version of the same messy idea is not enough
when a much simpler idea is visible. Measure twice, cut once: only what the diff and its callers show.

## Standards

0. **Simplify structurally.** Prefer deleting complexity to rearranging it.
1. **1000 lines.** A file this change pushes from under 1000 lines to over is a finding unless there is a
   strong structural reason and it stays clearly organised: ask for the split first.
2. **No spaghetti growth.** A new ad-hoc conditional, special case or one-off branch in an unrelated or
   already busy flow is a design problem, not a nit: move it behind its own abstraction, a table, a state
   machine or a policy.
3. **Clean the design, not just the behaviour.** Working code that leaves the codebase messier does not pass.
4. **Direct over magic.** Thin wrappers, identity abstractions, pass-through helpers and generic
   mechanisms that hide a simple data shape are findings.
5. **Types and boundaries.** Needless optionality, `any`, `unknown`, casts, or a silent fallback over an
   unclear invariant: make the contract explicit instead.
6. **Canonical layer.** Feature logic leaking into shared code, details leaking through an API, or a bespoke
   helper next to an existing canonical one (cite it): move it where the concept lives, reuse the helper.
7. **Orchestration.** Independent work serialized for no reason, or related updates that can leave state
   half-applied, when a cleaner parallel or atomic shape is obvious.

## Presumptive blockers

Unless the author can justify them clearly:

- incidental complexity kept when a plausible code-judo move would delete it;
- a file pushed from below 1000 lines to above;
- ad-hoc branching that tangles an existing flow, or feature checks scattered across shared code;
- an unnecessary abstraction, wrapper or cast-heavy contract that makes the design more indirect;
- a duplicated existing helper, or logic in the wrong layer when its canonical home is clear.

## Remedies to prefer

Delete a layer rather than polish it; reshape the state model so conditionals disappear; turn special
cases into a simpler default flow; replace condition chains with a typed model or one dispatcher; split a
large file by job; separate orchestration from logic; collapse duplicate branches; make updates atomic.

## Output

Order: structural regressions; missed code-judo moves; spaghetti growth; boundary and type problems;
file size; modularity; legibility. A few high-conviction findings beat many cosmetic ones; no naming or
style notes while structural issues exist. Be direct and serious, not rude: if the change makes the code
messier, say so plainly.

Adapted from Cursor's `thermo-nuclear-code-quality-review` (github.com/cursor/plugins, MIT), vendored in
full beside this skill; see `THIRD-PARTY.md`.
