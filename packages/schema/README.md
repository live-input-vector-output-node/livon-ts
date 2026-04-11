<!-- Generated from website/docs/packages/*.md. Do not edit directly. -->

# @livon/schema


[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/schema/badge.svg)](https://snyk.io/test/npm/@livon/schema)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

## Install

```sh
pnpm add @livon/schema
```

## Purpose

[@livon/schema](https://livon.tech/docs/packages/schema) defines:

- [value schemas](https://livon.tech/docs/schema) (`string`, `number`, `object`, `array`, `or`, `union`, ...)
- operation schemas
- subscription schemas
- [schema module](https://livon.tech/docs/technical/runtime-design) (`schemaModule`)

## Best for

Use this package when you want a single schema source for validation, typing, and generated client APIs.

## Schema API docs

Each schema/combinator has its own usage page:

- [Schema APIs overview](https://livon.tech/docs/schema)
- [Schema Type Safety](https://livon.tech/docs/schema/type-safety)
- [Schema Context](https://livon.tech/docs/schema/context)
- [string](https://livon.tech/docs/schema/string)
- [number](https://livon.tech/docs/schema/number)
- [boolean](https://livon.tech/docs/schema/boolean)
- [date](https://livon.tech/docs/schema/date)
- [enumeration](https://livon.tech/docs/schema/enumeration)
- [object](https://livon.tech/docs/schema/object)
- [array](https://livon.tech/docs/schema/array)
- [tuple](https://livon.tech/docs/schema/tuple)
- [literal](https://livon.tech/docs/schema/literal)
- [union](https://livon.tech/docs/schema/union)
- [or](https://livon.tech/docs/schema/or)
- [binary](https://livon.tech/docs/schema/binary)
- [before](https://livon.tech/docs/schema/before)
- [after](https://livon.tech/docs/schema/after)
- [and](https://livon.tech/docs/schema/and)
- [api](https://livon.tech/docs/schema/api)
- [operation](https://livon.tech/docs/schema/operation)
- [subscription](https://livon.tech/docs/schema/subscription)
- [fieldResolver](https://livon.tech/docs/schema/field-resolver)
- [schemaFactory](https://livon.tech/docs/schema/schema-factory)
- [typeGuards](https://livon.tech/docs/schema/type-guards)

## Type safety model

LIVON [schemas](https://livon.tech/docs/schema) are both runtime validators and type sources.
Primitive schema names are optional, so `string()` and `number()` are valid defaults.

1. Define payload shape once in [schema](https://livon.tech/docs/schema).
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

- [api](https://livon.tech/docs/schema/api)
- [operation](https://livon.tech/docs/schema/operation)
- [subscription](https://livon.tech/docs/schema/subscription)
- [fieldResolver](https://livon.tech/docs/schema/field-resolver)

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

If `explain: true`, [schema module](https://livon.tech/docs/technical/runtime-design) responds to `$explain` with AST/checksum metadata.

## Related pages

- [Validated by Default](https://livon.tech/docs/core/validated-by-default)
- [parse vs typed](https://livon.tech/docs/core/parse-vs-typed)
- [Schema APIs overview](https://livon.tech/docs/schema)
- [Runtime Design](https://livon.tech/docs/technical/runtime-design)
- [Architecture](https://livon.tech/docs/technical/architecture)
