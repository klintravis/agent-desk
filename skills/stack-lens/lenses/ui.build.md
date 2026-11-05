# UI lens: build

For anything a person sees or uses: web and desktop components, styles, CLI and TUI output.

- Every state has a screen: loading, empty, error, partial, and the long-text and many-items cases.
- Use the repo's own components, tokens and patterns before a native widget or a new one.
- Keyboard reachable, visible focus, labels on controls, text contrast at least 4.5:1, no meaning by
  colour alone.
- Show a UI change working on its real surface (the running app, the real terminal); a passing unit
  test alone does not prove it.
- CLI output: stable, parseable where scripts read it (`--json`), errors on stderr with a non-zero exit.
- Fewer controls done well beat more done roughly: every new option must earn its place.
