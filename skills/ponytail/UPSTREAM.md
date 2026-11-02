# Vendored skill — do not edit here

Source: https://github.com/DietrichGebert/ponytail `skills/ponytail/SKILL.md`
Pinned commit: 96608e078b2d5ea607c5c3b8b5a54d1c1fba6846 (plugin v5.3.3), MIT — see `LICENSE`.

One deviation from upstream: `description: >` became `description: >-` (skill-authoring's
block-scalar rule). To update, re-fetch at a new commit and re-apply that one change.

Always-on mode: upstream's plugin runs `hooks/ponytail-activate.js` on SessionStart, which emits
this SKILL.md, stripped of frontmatter and filtered to the active level, as session context.
agent-desk does not vendor the plugin. Its `scripts/subagent-context.mjs` hook (SessionStart and
SubagentStart, from the agent-desk plugin or the generated Copilot hooks) does the same for level
`full` from this file, followed by the desk's agent rules. It prints nothing useful when this file
is absent. What it leaves out of upstream's plugin:
- no mode tracking, so a compaction after "stop ponytail" turns it back on;
- no statusline, band, ledger or codebase map.

The hook keeps only the `full` row of the Levels table. `/ponytail lite|ultra` still works,
because invoking the skill loads this whole file.

Only four of upstream's six skills are vendored. `ponytail-help` documents the plugin's
hooks, band and config file, and `ponytail-gain` cites upstream's `benchmarks/` — neither
exists without the full plugin, which agent-desk does not install.
