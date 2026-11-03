## MODIFIED Requirements

### Requirement: Release workflow
Pushing a tag `v*` SHALL run `.github/workflows/release.yml` with `contents: write`. On a private repository the job SHALL be skipped. The job SHALL fail unless the tagged commit is an ancestor of `origin/main`, SHALL run `npm test`, SHALL package `vscode/` with a pinned `@vscode/vsce` before the release exists, and SHALL create the GitHub release named after the tag, with the `notes` output as its body and the vsix attached, using `--verify-tag`.

#### Scenario: Tag on main
- **WHEN** a tag `v0.2.0` on a commit on `main` is pushed and the bump is merged
- **THEN** a GitHub release `v0.2.0` is created with the CHANGELOG section as its body and the vsix attached

#### Scenario: Tag off main
- **WHEN** the tagged commit is not on `main`
- **THEN** the job fails before any release is created

#### Scenario: Tag on the private repo
- **WHEN** a tag `v*` is pushed to a private repository
- **THEN** the job is skipped and no release is created

#### Scenario: Packaging fails
- **WHEN** packaging `vscode/` fails
- **THEN** the job fails and no release is created
