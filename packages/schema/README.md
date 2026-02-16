# @livon/schema

[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Code Quality](https://img.shields.io/badge/code%20quality-eslint%20%2B%20tsc-1f6feb)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](../../LIZENZ.md)

## Install

```sh
pnpm add @livon/schema
```

## Purpose

[@livon/schema](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/schema) defines:

- [value schemas](https://live-input-vector-output-node.github.io/livon-ts/docs/schema) (`string`, `number`, `object`, `array`, `or`, `union`, ...)
- operation schemas
- subscription schemas
- [schema runtime module](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/runtime-design) (`schemaModule`)

## Schema API docs

Each schema/combinator has its own usage page:

- [Schema APIs overview](https://live-input-vector-output-node.github.io/livon-ts/docs/schema)
- [Schema Type Safety](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety)
- [Schema Context](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/context)
- [string](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/string)
- [number](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/number)
- [boolean](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/boolean)
- [date](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/date)
- [enumeration](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/enumeration)
- [object](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/object)
- [array](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/array)
- [tuple](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/tuple)
- [literal](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/literal)
- [union](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/union)
- [or](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/or)
- [binary](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/binary)
- [before](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/before)
- [after](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/after)
- [and](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/and)
- [api](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/api)
- [operation](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/operation)
- [subscription](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/subscription)
- [fieldResolver](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/field-resolver)
- [schemaFactory](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/schema-factory)
- [typeGuards](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-guards)

## Type safety model

LIVON [schemas](https://live-input-vector-output-node.github.io/livon-ts/docs/schema) are both runtime validators and type sources.
Primitive schema names are optional, so `string()` and `number()` are valid defaults.

1. Define payload shape once in [schema](https://live-input-vector-output-node.github.io/livon-ts/docs/schema).
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

export const serverSchema = apiSchema;
```

### Parameters in this example

`api({...})`:

- `type` (`Schema`, optional): entity schema for field operations.
- `operations` (`Record<string, Operation>`, optional): request/response operations.
- `subscriptions` (`Record<string, Subscription | Schema>`, optional): publish topic schemas.
- `fieldOperations` (`Record<string, FieldOperation>`, optional): field-level resolvers.

For focused usage patterns:

- [api](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/api)
- [operation](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/operation)
- [subscription](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/subscription)
- [fieldResolver](https://live-input-vector-output-node.github.io/livon-ts/docs/schema/field-resolver)

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

If `explain: true`, [schema module](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/runtime-design) responds to `$explain` with AST/checksum metadata.

## Related pages

- [Validated by Default](https://live-input-vector-output-node.github.io/livon-ts/docs/core/validated-by-default)
- [parse vs typed](https://live-input-vector-output-node.github.io/livon-ts/docs/core/parse-vs-typed)
- [Schema APIs overview](https://live-input-vector-output-node.github.io/livon-ts/docs/schema)
- [Runtime Design](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/runtime-design)
- [Architecture](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/architecture)
