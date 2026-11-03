## 1. Implementation

- [x] 1.1 `.catch(() => {})` on both Decide presses (`hooks/pane.tsx`) (no test: `$.ui.toast` can be made to throw, but the harness has no `process` and surfaces no unhandled rejection; the press test passed with and without the `.catch`)
- [x] 1.2 Wording in README and CHANGELOG
- [x] 1.3 Scrub the dialog answer before `desk decide` (a test showed it reached the record raw), with a test
