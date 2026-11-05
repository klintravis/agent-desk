---
name: stack-lens
description: >-
  Domain and stack rules for building or reviewing a change: TypeScript, tests, state and
  concurrency, performance, security boundaries, UI. Each lens has a build file (implementer) and a
  review file (reviewer). Load when a brief names a lens, or when a change touches one of the
  stacks below; read only the files that apply.
---

# Stack lens

Read only the lenses the brief names, or that the change's files and subject match below, and of each
only your half: `lenses/<lens>.build.md` if you write the change, `lenses/<lens>.review.md` if you review
it. The repo's own rules (`CLAUDE.md`, `AGENTS.md`, lint and compiler config) win over a lens. A review
rule broken is a finding only with the concrete case your review skill demands.

| Lens | Applies when the change |
|---|---|
| typescript | touches `*.ts`, `*.tsx`, `*.mts`, `*.cts` |
| testing | adds or changes tests, or fixes a bug |
| state | writes files, databases, caches or shared state; retries, locks, queues, lifecycles, concurrency |
| perf | claims a speed or memory change, or touches a hot path the brief names |
| security | parses outside input, runs commands, handles secrets or auth, gates a feature, changes env vars, ports or setup |
| ui | changes what a person sees or clicks: components, styles, CLI or TUI output |

No lens fits a stack the change uses (Python, Go, SQL, ...)? Use the repo's linters and conventions.
