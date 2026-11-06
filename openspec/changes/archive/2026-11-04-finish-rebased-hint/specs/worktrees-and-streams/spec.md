## MODIFIED Requirements

### Requirement: wt finish rejected push
When git rejects the push of `wt finish` as non-fast-forward, the error SHALL say to rerun with `--rebased` (unless it already ran with `--rebased`), and SHALL in both cases say to integrate the remote commits (`git rebase origin/<branch>`) or, only if nobody else pushed to it, delete the remote branch (`git push origin --delete <branch>`), since `--rebased` never overwrites commits the branch has not seen.

#### Scenario: Amended after a push
- **WHEN** the pushed branch was amended or rebased and `wt finish` runs without `--rebased`
- **THEN** it fails with `git push failed: ... rerun with --rebased`

#### Scenario: Old remote branch of the same name
- **WHEN** a fresh worktree's branch meets a remote branch with commits it never had, with or without `--rebased`
- **THEN** the error also says to integrate them or, only if nobody else pushed to it, delete the remote branch, and `--rebased` still does not overwrite them
