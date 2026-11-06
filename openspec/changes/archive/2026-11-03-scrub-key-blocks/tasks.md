## 1. Implementation

- [x] 1.1 `PRIVATE_KEY` in `hooks/secretpatterns.mjs`: optional ` BLOCK`, end of text closes a block; remove the scan for the last END
- [x] 1.2 Tests in `hooks/redact.test.ts`: no END, PGP with and without END, `hasSecret` agrees, a closed RSA block keeps the text after it, many opening markers stay fast
