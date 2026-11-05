# Security and boundaries lens

## Build

- Validate and parse where data crosses in (CLI args, config, env, HTTP, files, IPC, model or log
  output) into a typed value; trust it inside. Don't re-check deep in the call chain.
- Commands: pass arguments as an array, never a string built from outside input. No shell where a direct
  exec works.
- Secrets: read them where the repo already reads them; never log, echo, commit or put them in a URL or
  an error message.
- Auth and feature gates: check on the server side of the boundary. A gated feature is reachable only
  through its gate.
- Keep business logic in pure functions; the shell around it (framework, I/O) stays thin.

## Review

Trace the changed code end to end; only added or modified code counts. A finding, each with the input
or the path that triggers it:

- injection (shell, SQL, path, template, regex), a check missing on outside input, weak randomness for
  a secret or token;
- a secret that can reach a log, an error, a URL or the repo;
- a gated feature reachable without its gate (flags, internal-only checks) — these leaks are subtle;
- a devex break: a renamed or new required env var, a moved secret, a remapped port, a new step every
  developer must now run (a new optional way to run things is not one);
- a change that breaks a caller in another module or package.

Report what the evidence supports at the severity it deserves: overstated findings make people stop
listening. Don't report a risk you could settle by reading the other side (the server, the caller):
read it first. A break the change clearly intends, with a narrow scope, is not a finding unless its
reach looks wider than the author knows.
