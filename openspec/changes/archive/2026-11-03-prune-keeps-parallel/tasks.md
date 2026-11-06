## 1. Implementation

- [x] 1.1 `prune` in `hooks/prune.ts` leaves `use.text` alone and rebuilds a call row only when it is alone in its assistant run
- [x] 1.2 Tests in `hooks/register.test.ts`: parallel rows keep their handles while results are cut; a parallel write stays whole
- [x] 1.3 README section "Auto-compaction prune" and a CHANGELOG line
