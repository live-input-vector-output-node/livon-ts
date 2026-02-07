---
title: Schema Type Safety
sidebar_position: 2
---

LIVON treats schemas as the single source of truth for validation and types.

## No manual transport types required

Define the schema once, then derive everything from it:

```ts
import {object, string, number, type Infer} from '@livon/schema';

const User = object({
  name: 'User',
  shape: {
    id: string(),
    age: number().int().min(0),
  },
});

type UserType = Infer<typeof User>;
```

`UserType` is derived from the schema shape, not hand-written.

### Parameters in this example

`object({...})`:

- `name` (`string`): schema node name.
- `shape` (`Record<string, Schema>`): field schema map.

`number().int().min(0)`:

- `min` (`number`): minimum allowed value.

## `parse()` = runtime validation + typed return

Use `parse()` when input is unknown at runtime:

```ts
const input: unknown = JSON.parse(rawPayload);
const user = User.parse(input);
```

If validation fails, `parse()` throws a schema validation error.
If validation succeeds, `user` is strongly typed.

### Parameters in this example

`User.parse(input)`:

- `input` (`unknown`): runtime value to validate and parse.

## `typed()` = typed contract entry

Use `typed()` when the value is already typed and you want the same schema contract entrypoint:

```ts
const typedValue: UserType = {id: 'u-1', age: 21};
const user = User.typed(typedValue);
```

`typed()` follows the schema contract and returns the schema output type.

### Parameters in this example

`User.typed(typedValue)`:

- `typedValue` (`UserType`): already-typed value passed through schema contract entrypoint.

## End-to-end contract safety

1. Server operations/subscriptions are schema-defined.
2. Client API is generated from schema AST.
3. Payload types come from schema contracts end-to-end.

This keeps frontend/backend payload typing aligned without duplicating type definitions.
