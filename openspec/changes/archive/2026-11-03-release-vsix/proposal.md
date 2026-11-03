## Why

The VS Code extension is built from `vscode/` but a release carried no installable file (T-133). The release workflow now packages it and attaches the vsix.

## What Changes

- `release.yml` packages `vscode/` with a pinned `@vscode/vsce` after `notes` and before `gh release create`, and attaches the vsix.
- Packaging failure leaves no release.
- The checkout does not persist the token, since `npx` runs third-party code in a job with `contents: write`.

## Capabilities

### Modified Capabilities
- `release`: Release workflow.
