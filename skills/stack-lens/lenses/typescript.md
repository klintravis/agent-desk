# TypeScript lens

## Build

- Model variants as a discriminated union with one literal tag (`kind`), not a bag of optional fields
  and booleans that can contradict each other.
- External data (JSON, RPC, CLI args, env, files) is `unknown` until parsed at the boundary into a named
  type. Use the repo's schema library if it has one (infer the type from the schema). Trust the type inside.
- No `as` except right after a check that proves it. Prefer `satisfies` to keep literal types. A type
  guard (`isX`) must really check what it claims.
- Narrow in this order: discriminant `switch` > `in` > `typeof`/`instanceof` > a type guard > `as`.
- `switch` over a union or enum ends in `default: { const _exhaustive: never = x; }` so a new variant
  fails the build.
- Brand primitives that must not mix (`type UserId = string & { readonly __brand: 'UserId' }`), minted
  by a checking function only.
- Derive types (`Pick`, `Omit`, `ReturnType`, `Awaited`, `typeof`) before declaring a parallel interface.
- Imports at the top of the module; no inline `import()` types or calls without a circular-import reason.
- No `console.log` in shipped code; use the repo's logger.

## Review

A finding when the diff adds: `any`, or an `as` with no check before it; an optional field or flag
whose meaning depends on another field; a `switch` without the `never` arm over a union that will grow;
a hand-written type that duplicates one a schema or function already gives; a guard that does not check
what its name says.
