---
title: "@livon/schema"
sidebar_position: 2
---

## Install

```sh
pnpm add @livon/schema
```

## Purpose

[@livon/schema](/docs/packages/schema) defines:

- [value schemas](/docs/schema) (`string`, `number`, `object`, `array`, `or`, `union`, ...)
- operation contracts
- subscription contracts
- [schema runtime module](/docs/technical/runtime-design) (`schemaModule`)

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

LIVON [schema contracts](/docs/schema) are both runtime validators and type sources.
Primitive schema names are optional, so `string()` and `number()` are valid defaults.

1. Define payload shape once in [schema](/docs/schema).
2. Validate unknown input with `parse()`.
3. Reuse schema contract entrypoint with `typed()`.
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

- `typedInput` (`UserType`): pretyped value using same schema contract entrypoint.

## Compose API contract

```ts
import {api, createSchemaModuleInput} from '@livon/schema';

const apiSchema = api({
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

export const serverSchema = createSchemaModuleInput(apiSchema);
```

### Parameters in this example

`api({...})`:

- `type` (`Schema`, optional): entity schema for field operations.
- `operations` (`Record<string, Operation>`, optional): request/response operations.
- `subscriptions` (`Record<string, Subscription | Schema>`, optional): publish topic contracts.
- `fieldOperations` (`Record<string, FieldOperation>`, optional): field-level resolvers.

`createSchemaModuleInput(apiSchema)`:

- `apiSchema` (`Api`): fully composed schema contract exported to runtime module.

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

- `serverSchema` (`SchemaModuleInput`): output of `createSchemaModuleInput(...)`.
- `options.explain` (`boolean`, optional): enables `$explain` endpoint for AST/checksum metadata.

## Explain endpoint

If `explain: true`, [schema module](/docs/technical/runtime-design) responds to `$explain` with AST/checksum metadata.

## Related pages

- [Schema APIs overview](../schema)
- [Runtime Design](/docs/technical/runtime-design)
- [Architecture](/docs/technical/architecture)
