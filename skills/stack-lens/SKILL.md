---
name: stack-lens
description: >-
  Domain and stack rules for building or reviewing a change: TypeScript, tests, state and
  concurrency, performance, security boundaries, UI. Each lens has a Build half (implementer) and a
  Review half (reviewer). Load when a brief names a lens, or when a change touches one of the
  stacks below; read only the lens files that apply.
---

# Stack lens

A lens is a short list of rules for one stack or domain. Read only the lenses the brief names, or
that the change's files and subject match below; never all of them. The repo's own rules
(`CLAUDE.md`, `AGENTS.md`, lint and compiler config) win over a lens.

| Lens | Applies when the change | File |
|---|---|---|
| typescript | touches `*.ts`, `*.tsx`, `*.mts`, `*.cts` | `lenses/typescript.md` |
| testing | adds or changes tests, or fixes a bug | `lenses/testing.md` |
| state | writes files, databases, caches or shared state; retries, locks, queues, lifecycles, concurrency | `lenses/state.md` |
| perf | claims a speed or memory change, or touches a hot path the brief names | `lenses/perf.md` |
| security | parses outside input, runs commands, handles secrets or auth, gates a feature, changes env vars, ports or setup | `lenses/security.md` |
| ui | changes what a person sees or clicks: components, styles, CLI or TUI output | `lenses/ui.md` |

- Implementer: apply each lens's **Build** half while you write, and say in your report which lenses you used.
- Reviewer: check each lens's **Review** half against the diff. A lens rule broken is a finding only with
  the concrete case your review skill demands; a lens never lowers that bar.
- No lens fits a stack the change uses (Python, Go, SQL, ...)? Use the repo's linters and conventions;
  don't invent a lens.

Sources: adapted from Lauren Tan's pstack and Cursor's cursor-team-kit and thermos plugins
(github.com/cursor/plugins, MIT); see `THIRD-PARTY.md`.
