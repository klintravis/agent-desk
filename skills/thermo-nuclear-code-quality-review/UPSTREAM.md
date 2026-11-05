# Vendored skill — do not edit here

Source: https://github.com/cursor/plugins `thermos/skills/thermo-nuclear-code-quality-review/SKILL.md`
(the same file ships in `cursor-team-kit/`). Pinned commit: bb68f2365eceafa0cb2d253112f675acf5f144cc, MIT — see `LICENSE`.

One deviation from upstream: the `disable-model-invocation: true` line is dropped, so the
`structure-reviewer` agent can load the skill. To update, re-fetch at a new commit and drop that line again.

Not vendored: upstream's `thermos` orchestrator and its two subagents. They have a parent paste the diff
and every changed file into the prompt; the desk's `structure-reviewer` reads the worktree itself, which
costs fewer tokens on a large change. The sibling `thermo-nuclear-review` (security and correctness) is
not vendored either: its rules that the desk's review lacked (devex breaks, feature-gate leaks, intended
breakage, no unfinished research, read PR threads only after your own pass) are in `agents/reviewer.md`.
