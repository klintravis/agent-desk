# Third-party code

Parts of the mod (`hooks/`) and of `desk status` are ported from the Claude Code mods below, each under the MIT license.
The vendored Ponytail skills keep their own `skills/ponytail/LICENSE` and `UPSTREAM.md`.
The vendored `skills/thermo-nuclear-code-quality-review/` (Cursor's thermos plugin) keeps its own `LICENSE` and `UPSTREAM.md`;
`skills/structure-rubric/SKILL.md` is condensed from it under the same MIT license.

| Port | From | Copyright |
|---|---|---|
| `hooks/quota.ts` (plan quota, burn rate) | quota-meter 0.1.0, github.com/Arunjay4213/claude-mods | Arunjay. MIT per the plugin's `plugin.json`; the repo has no LICENSE file. |
| `hooks/warmhold.ts` (cold-cache guard, auto-arm after a cold write) | cache-tax | Copyright (c) 2026 Karan Bansal |
| `hooks/meters.ts` `ctxLine` (context fullness) | context-lens 0.1.0, github.com/Arunjay4213/claude-mods | Arunjay. MIT per the plugin's `plugin.json`; the repo has no LICENSE file. |
| `hooks/meters.ts` `cacheLine` (cache hit) | token-ledger 0.1.0, github.com/Arunjay4213/claude-mods | Arunjay. MIT per the plugin's `plugin.json`; the repo has no LICENSE file. |
| `hooks/redact.ts`, `hooks/secretpatterns.mjs` (secret redaction) | secret-redactor 1.0.0, github.com/ray-amjad/awesome-claude-code-function-hooks | Copyright (c) 2026 Ray Amjad |
| `bin/desk.mjs` `ghPrs`, `prState` (PR review state in `desk status`) | pr-pulse 0.1.0 | Copyright (c) 2026 Gerric Chaplin |
| `skills/fix/SKILL.md`, `skills/refactor/SKILL.md` (adapted from the bug-fix and refactoring playbooks and the `tdd`, `principle-*` skills) | pstack, github.com/cursor/plugins `pstack/` | Copyright (c) 2026 Lauren Tan |
| `skills/validate/SKILL.md` (adapted from `verify-this`) | cursor-team-kit, github.com/cursor/plugins | Copyright (c) 2026 Cursor |
| `skills/stack-lens/lenses/*.md`, `skills/stack-lens/SKILL.md` (rules adapted from `typescript-best-practices`, `tdd`, `benchmark-checklist` and the `principle-*` skills) | pstack, github.com/cursor/plugins `pstack/` | Copyright (c) 2026 Lauren Tan |
| `skills/stack-lens/lenses/*.md` (`typescript-exhaustive-switch`, `no-inline-imports`, `deslop`), `agents/reviewer.md` and `skills/stack-lens/lenses/security.*.md` (rules from `thermo-nuclear-review`), `agents/implementer.md` (self-deslop step) | cursor-team-kit and thermos, github.com/cursor/plugins | Copyright (c) 2026 Cursor |
| `skills/grill/SKILL.md` (idea from `grilling` and `interview-me`; written from scratch, no text copied) | mattpocock/skills, github.com/mattpocock/skills; agent-skills, github.com/addyosmani/agent-skills | Copyright (c) 2026 Matt Pocock; Copyright (c) 2025 Addy Osmani |

The MIT license, as it applies to each port above:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
> OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
> CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
