---
title: "@livon/schema"
sidebar_position: 2
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

## Install

```sh
pnpm add @livon/schema
```

## Purpose

[@livon/schema](/docs/packages/schema) defines:

- [value schemas](/docs/schema) (`string`, `number`, `object`, `array`, `or`, `union`, ...)
- operation schemas
- subscription schemas
- [schema module](/docs/technical/runtime-design) (`schemaModule`)

## Best for

Use this package when you want a single schema source for validation, typing, and generated client APIs.

## Schema API docs

Each schema/combinator has its own usage page:

- [Schema APIs overview](../schema)
- [Schema Type Safety](../schema/type-safety)
- [Schema Context](../schema/context)
- [string](../schema/string)
- [number](../schema/number)
- [boolean](../schema/boolean)
- [date](../schema/date)
- [enumeration](../schema/enumeration)
- [object](../schema/object)
- [array](../schema/array)
- [tuple](../schema/tuple)
- [literal](../schema/literal)
- [union](../schema/union)
- [or](../schema/or)
- [binary](../schema/binary)
- [before](../schema/before)
- [after](../schema/after)
- [and](../schema/and)
- [api](../schema/api)
- [operation](../schema/operation)
- [subscription](../schema/subscription)
- [fieldResolver](../schema/field-resolver)
- [schemaFactory](../schema/schema-factory)
- [typeGuards](../schema/type-guards)

## Type safety model

LIVON [schemas](/docs/schema) are both runtime validators and type sources.
Primitive schema names are optional, so `string()` and `number()` are valid defaults.

1. Define payload shape once in [schema](/docs/schema).
2. Validate unknown input with `parse()`.
3. Reuse schema entrypoint with `typed()`.
4. Derive types with `Infer` instead of hand-written payload interfaces.

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

const input: unknown = JSON.parse(raw);
const parsed = User.parse(input);
const typedInput: UserType = {id: 'u-1', age: 21};
const typed = User.typed(typedInput);
```

### Parameters in this example

`object({...})`:

- `name` (`string`): schema node name.
- `shape` (`Record<string, Schema>`): field schema map.

`number().int().min(0)`:

- `min` (`number`): minimum allowed numeric value.

`User.parse(input)`:

- `input` (`unknown`): runtime value to validate/parse.

`User.typed(typedInput)`:

- `typedInput` (`UserType`): pretyped value using same schema entrypoint.

## Compose API schema

```ts
import {api} from '@livon/schema';

const ApiSchema = api({
  type: User,
  operations: {
    sendMessage,
  },
  subscriptions: {
    onMessage,
  },
  fieldOperations: {
    greeting: userGreetingResolver,
  },
});

export const serverSchema = ApiSchema;
```

Use the `api(...)` (or `composeApi(...)`) result directly in `schemaModule(...)`.
No additional schema-module input factory is required.

### Parameters in this example

`api({...})`:

- `type` (`Schema`, optional): entity schema for field operations.
- `operations` (`Record<string, Operation>`, optional): request/response operations.
- `subscriptions` (`Record<string, Subscription | Schema>`, optional): publish topic schemas.
- `fieldOperations` (`Record<string, FieldOperation>`, optional): field-level resolvers.

For focused usage patterns:

- [api](../schema/api)
- [operation](../schema/operation)
- [subscription](../schema/subscription)
- [fieldResolver](../schema/field-resolver)

## Mount schema module into runtime

```ts
import {runtime} from '@livon/runtime';
import {schemaModule} from '@livon/schema';

runtime(schemaModule(serverSchema, {explain: true}));
```

### Parameters in this example

`schemaModule(serverSchema, options?)`:

- `serverSchema` (`Api | ComposedApi`): fully composed schema from `api(...)` or `composeApi(...)`.
- `options.explain` (`boolean`, optional): enables `$explain` endpoint for AST/checksum metadata.

## Explain endpoint

If `explain: true`, [schema module](/docs/technical/runtime-design) responds to `$explain` with AST/checksum metadata.

## Related pages

- [Validated by Default](/docs/core/validated-by-default)
- [parse vs typed](/docs/core/parse-vs-typed)
- [Schema APIs overview](../schema)
- [Runtime Design](/docs/technical/runtime-design)
- [Architecture](/docs/technical/architecture)
