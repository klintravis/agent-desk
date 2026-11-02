# Third-party code

Parts of the mod (`hooks/`) and of `desk status` are ported from the Claude Code mods below, each under the MIT license.
The vendored Ponytail skills keep their own `skills/ponytail/LICENSE` and `UPSTREAM.md`.

| Port | From | Copyright |
|---|---|---|
| `hooks/quota.ts` (plan quota, burn rate) | quota-meter 0.1.0, github.com/Arunjay4213/claude-mods | Arunjay. MIT per the plugin's `plugin.json`; the repo has no LICENSE file. |
| `hooks/warmhold.ts` (cold-cache guard, auto-arm after a cold write) | cache-tax | Copyright (c) 2026 Karan Bansal |
| `hooks/meters.ts` `ctxLine` (context fullness) | context-lens 0.1.0, github.com/Arunjay4213/claude-mods | Arunjay. MIT per the plugin's `plugin.json`; the repo has no LICENSE file. |
| `hooks/meters.ts` `cacheLine` (cache hit) | token-ledger 0.1.0, github.com/Arunjay4213/claude-mods | Arunjay. MIT per the plugin's `plugin.json`; the repo has no LICENSE file. |
| `hooks/redact.ts` (secret redaction) | secret-redactor 1.0.0, github.com/ray-amjad/awesome-claude-code-function-hooks | Copyright (c) 2026 Ray Amjad |
| `bin/desk.mjs` `ghPrs`, `prState` (PR review state in `desk status`) | pr-pulse 0.1.0 | Copyright (c) 2026 Gerric Chaplin |

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
