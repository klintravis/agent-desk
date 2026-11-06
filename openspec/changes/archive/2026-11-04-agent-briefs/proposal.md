## Why

The `verifier` judged CI from the branch's newest run, which can belong to an older commit, and the `reviewer` was told to write a file it has no tool for. `scripts/release.mjs` printed nothing when started through a junction (T-212).

## What Changes

- `verifier` reads CI by the head commit, all workflows, with `-R <owner/name>`; green is `success` or `skipped`.
- `reviewer` returns the PR findings in its reply after the verdict; the desk session saves them.
- `release.mjs` runs when started through a link; one shared `isMain` guard serves it and three other scripts.
- No new option or config.

## Capabilities

### Modified Capabilities
- `kit-agents`: new requirements for `verifier` CI and `reviewer` PR findings.
- `release`: a requirement and scenario for starting the scripts through a link.
