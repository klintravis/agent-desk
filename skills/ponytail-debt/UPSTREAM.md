# Vendored skill — do not edit here

Source: https://github.com/DietrichGebert/ponytail `skills/ponytail-debt/SKILL.md`
Pinned commit: 96608e078b2d5ea607c5c3b8b5a54d1c1fba6846 (plugin v5.3.3), MIT — see `LICENSE`.

One deviation from upstream: `description: >` became `description: >-` (skill-authoring's
block-scalar rule). To update, re-fetch at a new commit and re-apply that one change.

Only four of upstream's six skills are vendored. `ponytail-help` documents the plugin's
hooks, band and config file, and `ponytail-gain` cites upstream's `benchmarks/` — neither
exists without the full plugin, which agent-desk does not install.
