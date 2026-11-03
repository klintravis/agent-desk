## Why

At work, agents may merge into agent branches but not into the default or a release branch: they
review and recommend, and a person merges on the server. At home the owner runs the repo alone and
agents merge to the default branch, as `desk wt merge` does today. The kit knows only the second way
(`lib/wt.mjs:143-164`).

## What Changes

- New per-repo key in `desk.config.json`: `merge: "direct"` (default, today's behaviour) or
  `merge: "review"`. No existing desk changes.
- Under `review`, `desk wt merge <slug>` keeps its unpushed, CI and verdict gates and ends by opening
  or updating a pull request with `gh`, carrying the verdict and the findings. It never fast-forwards
  or pushes the default branch.
- **Changed from what the owner was told:** the PR opens at `desk wt merge`, not at `desk wt finish`.
  Finish runs before the review (`skills/orchestrate/SKILL.md:77-81`), so at that point there is no
  verdict or findings for the PR to carry. Moving it also means the pipeline and the skills barely
  change.
- After a person merges on the server, re-running `desk wt merge <slug>` closes the work: it asks `gh`
  for the PR state, then closes the worktree, branch, claim and todos. Squash and rebase merges work.
- New `desk wt merge <slug> --into <other-slug>`: agent-to-agent merge, then closes the source. It is
  allowed on both policies.
- Three parts of enforcement under `review`, and **only the server rule is a guarantee**; the docs say
  so:
  1. `desk wt merge` refuses to touch protected branches.
  2. A hook refuses agent `git push` and `git merge` to protected branches, and `gh pr merge`
     (edit-guard pattern, fails open). Agent tag pushes stay allowed: `refs/tags/*` and `--tags` pass;
     a bare short name such as `git push origin v1.2` cannot be told from a branch and is refused.
  3. `desk check` warns when the server shows no branch protection. It never fails on this.
- Protected means every branch outside the repo's `branchPrefix`.
- On a desk with a `review` repo, `desk sync` denies the file-edit tools on `desk.config.json`, and
  `desk check` flags a change to the setting. Claude only. The deny does not stop the Bash tool:
  `design.md` states its exact reach.
- `desk status`, the Desk pane and `desk sync` show the policy and the PR state.

## Capabilities

### New Capabilities

None. Each part extends the capability that owns the code.

### Modified Capabilities

- `worktrees-and-streams`: `wt merge` is scoped to `direct`; adds the review path, the close after a
  server merge and `--into`.
- `desk-config`: the `merge` key.
- `desk-sync`: the deny and the output line.
- `desk-cli`: warnings in `desk check`; the PR state in `desk status`.
- `session-context`: the merge guard.
- `plugin-ui`: the Desk pane rows.

## Impact

- Code: `lib/wt.mjs`, `lib/config.mjs`, `lib/sync.mjs`, `bin/desk.mjs`, `hooks/register.ts`,
  `hooks/pane.tsx`, `hooks/redact.ts`; new `hooks/mergeguard.mjs`, `scripts/merge-guard.mjs`,
  `hooks/secretpatterns.mjs`.
- Schemas and types: `schemas/desk-config.schema.json`, `schemas/desk-status.schema.json`,
  `types/index.d.ts`.
- Skills and templates: `skills/orchestrate`, `skills/handoff`, `skills/kickoff`,
  `templates/AGENTS.md`, `agents/reviewer.md`.
- Docs: `README.md`, `CHANGELOG.md`, `openspec/inventory.md`.
- Sequencing: implement after T-86 (`desk tidy`) and T-88 (user settings). `design.md` lists what will
  need a rebase.
- No breaking change. A desk without the key behaves exactly as before.
