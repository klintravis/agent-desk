# Security and boundaries lens: build

- Validate and parse where data crosses in (CLI args, config, env, HTTP, files, IPC, model or log
  output) into a typed value; trust it inside. Don't re-check deep in the call chain.
- Commands: pass arguments as an array, never a string built from outside input. No shell where a direct
  exec works.
- Secrets: read them where the repo already reads them; never log, echo, commit or put them in a URL or
  an error message.
- Auth and feature gates: check on the server side of the boundary. A gated feature is reachable only
  through its gate.
- Keep business logic in pure functions; the shell around it (framework, I/O) stays thin.
