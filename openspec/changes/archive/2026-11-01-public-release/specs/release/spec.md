## MODIFIED Requirements

### Requirement: Release workflow
Pushing a tag `v*` SHALL run `.github/workflows/release.yml` with `contents: write`. On a private repository the job SHALL be skipped. The job SHALL fail unless the tagged commit is an ancestor of `origin/main`, SHALL run `npm test`, and SHALL create the GitHub release named after the tag, with the `notes` output as its body, using `--verify-tag`.

#### Scenario: Tag on main
- **WHEN** a tag `v0.2.0` on a commit on `main` is pushed and the bump is merged
- **THEN** a GitHub release `v0.2.0` is created with the CHANGELOG section as its body

#### Scenario: Tag off main
- **WHEN** the tagged commit is not on `main`
- **THEN** the job fails before any release is created

#### Scenario: Tag on the private repo
- **WHEN** a tag `v*` is pushed to a private repository
- **THEN** the job is skipped and no release is created

## ADDED Requirements

### Requirement: Publish to the public repo
`scripts/release.mjs publish <tag>` SHALL refuse a tag `notes` refuses, one not on `main`, or one whose version files and CHANGELOG differ from the checkout, and SHALL push to the remote `public`, atomically, one new commit holding the tag's tree as that repo's `main` and as the tag, with the public `main` as its only parent, or no parent when it has none. No private commit SHALL be reachable from what it pushes.

#### Scenario: First release
- **WHEN** the public repo is empty
- **THEN** its `main` and the tag are one root commit with the tag's tree

#### Scenario: Later release
- **WHEN** the public `main` exists
- **THEN** the new commit's only parent is that `main`

#### Scenario: Tag off main, out of step or already published
- **WHEN** the tag is not on `main`, its version files differ from the checkout, or the public repo already has it
- **THEN** publish fails and the public repo is unchanged

### Requirement: CI runners
`.github/workflows/ci.yml` SHALL run on the self-hosted runner when the repository the event belongs to is private and on hosted Linux, Windows and macOS otherwise. A runner SHALL never be registered on the public repo, since a fork's pull request runs its own copy of the workflow.

#### Scenario: Push to the private repo
- **WHEN** a branch is pushed to the private repo
- **THEN** CI runs on the self-hosted runner

#### Scenario: Push to the public repo
- **WHEN** a commit is pushed to the public repo
- **THEN** CI runs on the hosted runners

#### Scenario: Fork pull request
- **WHEN** a fork opens a pull request on the public repo
- **THEN** CI runs on the hosted runners and nothing runs on the owner's machine
