---
name: refactor
description: >-
  Intentional restructure approach, deliberately aggressive: pin today's behaviour, name the target
  shape, delete before adding, migrate every caller and delete the old path in the same branch, and
  prove the behaviour is unchanged. Overrides Ponytail's smallest-diff and keep-the-structure rules for
  the run. Use when a brief names the `refactor` approach, or for "refactor", "restructure",
  "simplify this module", "clean up this design", a `structure-reviewer` blocker.
---

# Refactor

The structure changes; the behaviour does not. This run is meant to be ambitious: look for the
"code judo" move that makes whole branches, modes, wrappers or layers disappear, not a tidier version
of the same idea.

**This replaces two Ponytail rules for this run:** "the shortest working diff wins" and "keep the
structure the codebase already has". Here the goal is the simplest *result*, and a large diff that
deletes more than it adds is the point. Ponytail's other rules still hold: no new options, config,
speculative abstraction or dependency; and its never-cut list (validation at trust boundaries, error
handling that prevents data loss, security, accessibility) is never cut.

1. **Pin the behaviour before anything moves.** Find the tests that cover the area and run them. Where
   coverage is thin, write characterization tests at the public boundary (what callers observe: return
   values, errors, files written, output), and commit them first (`test: pin <area>`). Type checks and
   lint are not a pin. A broad area: add an equivalence script that runs a set of inputs and prints the
   outputs, run it now, and keep the output as the baseline.
2. **Name the target shape.** Write it down in a few lines before editing: the modules, the types, who
   calls whom, built as if this design had been the requirement from day one. A state machine, union,
   table or one dispatcher where branches spread today. If the brief gives a target (a `structure-reviewer`
   plan), start from it. A target that adds indirection without deleting branches, duplicate rules or
   invalid states is the wrong target.
3. **Subtract first.** Delete dead code, one-caller wrappers, pass-through layers, unused options and
   redundant checks, and commit that before building the new shape.
4. **Build the lever.** More than a handful of similar edits: do one by hand, then script the rest (a
   codemod, a script with `git grep`), rerun it on the first one to prove it, and keep it in the report.
5. **Move in verifiable steps.** Each commit keeps the pin green; run the check after every step, not
   at the end. Migrate every caller to the new API and delete the old one in the same branch: no
   compatibility shim, no parallel old and new paths, no "deprecated" leftovers. After a rename,
   `git grep` the old name in code, strings, docs and config.
6. **Prove nothing changed.** The pinned tests pass *unedited*. A test you had to change was pinned to
   internals: list each one and why. The equivalence output matches the baseline byte for byte.
7. **Prove it was worth it.** Report before and after: lines (`git diff --shortstat`), the largest
   touched file's length, and the concepts a reader must hold (layers, flags, branches). If none went
   down, revert and say so.

A bug or a missing feature found on the way: don't fix it here. Note it (`desk todo add`) and keep the
pin on today's behaviour, bug included.

## Done when

- pinning tests committed before the restructure, passing unedited at the end (or each edit justified);
- equivalence output identical to the baseline, where one was taken;
- no old path, shim or deprecated alias left; no new behaviour;
- the before/after numbers show a net reduction.
