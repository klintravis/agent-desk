## Why

The scrub hid a private key only when its END marker was there, so a truncated paste went to the model with only the entropy rules between it and the key. PGP private key blocks, whose markers end in ` BLOCK`, were not recognised at all (T-167).

## What Changes

- A private key's opening marker with no END after it hides everything from that marker to the end of the text.
- PGP private key blocks count as private keys, closed or not.
- `hasSecret` agrees, so `desk decide` and the PR body check in `desk wt merge` refuse both shapes, and also refuse an opening marker quoted on its own.
- `PRIVATE_KEY` always matches once its opening marker does, so it is linear on raw text and the scan for the last END goes away.

## Capabilities

### Modified Capabilities
- `secret-redaction`: private key blocks with no END, and PGP private key blocks.

## Decisions

- No END means mask to the end of the text: over-masking is the safe side. A marker quoted alone in a document hides the rest of that string.
- The first END marker after the opening closes the block, of any type, as before: a closed block keeps the text after it.
- The spec describes the markers in words. A literal opening marker in `spec.md` would hide the rest of the file from every session that reads it.
- PUBLIC KEY blocks and the other secret patterns are unchanged.
