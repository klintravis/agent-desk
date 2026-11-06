## 1. Implementation

- [x] 1.1 `post` returns false on a bad kind or slug; `board post` exits 1; `board check` with no slug is a usage error; one test each
- [x] 1.2 `loadConfig` refuses a bad `harnesses` and a bad `floor` entry; one test each
- [x] 1.3 `desk init --harness` refuses an unknown or empty value before writing; `desk check` loads the desk config through `loadConfig` and reports a file that does not parse without quoting it; `desk status` shows no claims, without an error, for a refused config; one test each
- [x] 1.4 README, CHANGELOG (BREAKING)
