# Security and boundaries lens: review

Trace the changed code end to end; only added or modified code counts. A finding, each with the input
or the path that triggers it:

- injection (shell, SQL, path, template, regex), a check missing on outside input, weak randomness for
  a secret or token;
- a secret that can reach a log, an error, a URL or the repo;
- a gated feature reachable without its gate (flags, internal-only checks) — these leaks are subtle;
- a devex break: a renamed or new required env var, a moved secret, a remapped port, a new step every
  developer must now run (a new optional way to run things is not one);
- a change that breaks a caller in another module or package.

A break the change clearly intends, with a narrow scope, is not a finding unless its reach looks wider
than the author knows.
