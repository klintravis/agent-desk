# release Specification

## Purpose
How agent-desk is released: a git tag `v<version>` on `main` plus a GitHub release, one version for the CLI and the plugin. Implemented in `scripts/release.mjs` and `.github/workflows/release.yml`. There is no npm publish.

## Requirements

### Requirement: Version bump
`node scripts/release.mjs bump <version>` SHALL require `<version>` to be `x.y.z` and greater than the current version, and the current `package.json` and `.claude-plugin/plugin.json` versions to agree. It SHALL write the version into both files, keeping their formatting, and insert `## <version> - <YYYY-MM-DD>` under `## Unreleased` in `CHANGELOG.md`, so the Unreleased entries become that version's and an empty `## Unreleased` stays on top. On any refusal it SHALL exit 1 and write nothing.

#### Scenario: Good bump
- **WHEN** the current version is 0.1.0, Unreleased has entries and `bump 0.2.0` runs
- **THEN** both files say 0.2.0 and the entries sit under `## 0.2.0 - <today>` with an empty `## Unreleased` above

#### Scenario: Version not greater or not semver
- **WHEN** `bump 0.1.0`, `bump 0.0.9` or `bump 1.0` runs against 0.1.0
- **THEN** it exits 1 and no file changes

#### Scenario: Empty Unreleased
- **WHEN** `## Unreleased` has no entries
- **THEN** `bump` exits 1 and no file changes

### Requirement: Release notes
`node scripts/release.mjs notes <tag>` SHALL exit 1 unless `<tag>` equals `v` plus the version in both `package.json` and `.claude-plugin/plugin.json` and `CHANGELOG.md` has a section for that version. Otherwise it SHALL print that section's body, without its heading, to stdout.

#### Scenario: Matching tag
- **WHEN** both files say 0.1.0 and `notes v0.1.0` runs
- **THEN** the body of `## 0.1.0 - <date>` is printed and the exit code is 0

#### Scenario: Wrong tag
- **WHEN** `notes v9.9.9` runs against 0.1.0
- **THEN** it exits 1 and prints nothing to stdout

### Requirement: Version consistency test
`npm test` SHALL fail when the `package.json` and `.claude-plugin/plugin.json` versions differ, or when `CHANGELOG.md` has neither a section for that version nor an `## Unreleased` section.

#### Scenario: Versions differ
- **WHEN** the two files carry different versions
- **THEN** `npm test` fails

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

### Requirement: Docs drift check
`npm test` SHALL run `scripts/docs-check.mjs`, which reads commands, actions and flags from the code and fails when the README or `openspec/inventory.md` disagrees, and fails rather than passes when it cannot parse the code.

#### Scenario: Docs match the code
- **WHEN** the README's relative links resolve, its Node version matches `engines`, and the Commands table, README and inventory list what the code has
- **THEN** it prints `docs-check: ok` and exits 0

#### Scenario: A flag is undocumented
- **WHEN** a handler reads a flag that is in neither its Commands row nor a README section the row links
- **THEN** it prints `desk <command>: <flag> in <file>, not in README.md` and exits 1

#### Scenario: Git arguments
- **WHEN** a handler passes `--porcelain` or `--ff-only` to git
- **THEN** they are not counted as flags of the command

#### Scenario: Parser blind
- **WHEN** `const COMMANDS = {...}` in `bin/desk.mjs` cannot be parsed, or a handler function cannot be found
- **THEN** it reports a gap instead of passing

#### Scenario: Missing files
- **WHEN** `README.md` is missing from the checkout, or `openspec/inventory.md` is missing while `bin/desk.mjs` exists
- **THEN** it reports a gap and exits 1

#### Scenario: Scope
- **WHEN** the check reads documentation links and versions
- **THEN** it reads `README.md` only, not `docs/`, the CHANGELOG or openspec
