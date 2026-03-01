---
title: parse vs typed
sidebar_position: 3
---

`parse` and `typed` solve different runtime tasks.

## `parse(unknown)` for external-input validation

Use `parse` when data comes from outside your code and is not trusted.

```ts
import {number, object, string} from '@livon/schema';

const User = object({
  name: 'User',
  shape: {
    id: string(),
    age: number().int().min(18),
  },
});

const unknownInput: unknown = JSON.parse(raw);
const user = User.parse(unknownInput);
```

### Parameters in this example

`User.parse(value)`:

- `value` (`unknown`): untrusted incoming data.

## `typed(validInput)` for invariant entrypoints

Use `typed` when data is already local and should be structurally aligned at compile time before entering runtime flow.
`typed` also supports full IDE autocomplete for the schema-derived payload shape (including nested fields), because the input is typed as `Infer<typeof Schema>`.

```ts
import {type Infer} from '@livon/schema';

type UserType = Infer<typeof User>;

const invalid: UserType = {id: 'u-1', age: '21'};
// TypeScript error: age must be number

const valid = User.typed({id: 'u-1', age: 21});
```

Autocomplete example:

```ts
const draft = User.typed({
  id: 'u-1',
  // IDE suggests remaining fields from the full schema shape, e.g. age
  age: 21,
});
```

### Parameters in this example

`User.typed(value)`:

- `value` (`Infer<typeof User>`): compile-time aligned value that is still checked against runtime constraints.

## Compile-time alignment plus runtime constraints

`typed` shifts structural mismatches (field type/shape) to compile time, but constraint checks still run at runtime.

```ts
const maybeAdult = User.typed({id: 'u-1', age: 16});
// Compiles structurally (number), but runtime validation fails on min(18)
```

## Practical rule

- Use `parse` for external input.
- Use `typed` for internal invariants before emitting or executing.
- Both reinforce deterministic runtime checks.

## Related concepts

- [Validated by Default](validated-by-default)
- [Backend / Frontend Symmetry](backend-frontend-symmetry)
