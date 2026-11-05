# TypeScript lens: review

A finding when the diff adds: `any`, or an `as` with no check before it; an optional field or flag
whose meaning depends on another field; a `switch` without the `never` arm over a union that will grow;
a hand-written type that duplicates one a schema or function already gives; a guard that does not check
what its name says.
