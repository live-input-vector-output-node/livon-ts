---
title: Schema Type Safety
sidebar_position: 2
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/schema/badge.svg)](https://snyk.io/test/npm/@livon/schema)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

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

## `typed()` = typed schema entry

Use `typed()` when the value is already typed and you want the same schema entrypoint:

```ts
const typedValue: UserType = {id: 'u-1', age: 21};
const user = User.typed(typedValue);
```

`typed()` follows the schema and returns the schema output type.

### Parameters in this example

`User.typed(typedValue)`:

- `typedValue` (`UserType`): already-typed value passed through schema entrypoint.

## End-to-end schema safety

1. Server operations/subscriptions are schema-defined.
2. Client API is generated from schema AST.
3. Payload types come from schemas end-to-end.

This keeps frontend/backend payload typing aligned without duplicating type definitions.
