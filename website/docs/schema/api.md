---
title: "api"
sidebar_position: 17
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)


Use `api({...})` to compose operation and subscription schemas into one API schema.

## Minimal usage

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
```

## Runtime handoff

Pass the `ApiSchema` result directly to `schemaModule(...)`:

```ts
import {runtime} from '@livon/runtime';
import {schemaModule} from '@livon/schema';

runtime(schemaModule(ApiSchema, {explain: true}));
```

No extra schema-module input adapter is required.

## `api({...})` input shape

- `type` (optional): entity schema for field resolvers
- `operations` (optional): named map of operations
- `subscriptions` (optional): named map of subscriptions
- `fieldOperations` (optional): named map of field resolvers
- `doc` (optional): API-level docs metadata
- operation shorthand keys (optional): operation entries can also be added directly on the root object

## Parameters

- `type` (`Schema`, optional): entity schema required when `fieldOperations` are used.
- `operations` (`Record<string, operation(...)>`, optional): operation map.
- `subscriptions` (`Record<string, subscription(...) | Schema>`, optional): subscription map.
- `fieldOperations` (`Record<string, fieldOperation(...)>`, optional): field resolvers.
- `doc` (`SchemaDoc`, optional): API-level metadata.
- operation shorthand keys (`operation(...)`, optional): operation entries can also be defined directly on the root object.

## Chain API

- `api` does not expose schema chain methods (`return type: Api<...>`, not `Schema<T>`).
- Use `operation`, `subscription`, and `fieldOperation` to compose behavior.

## Rules

- Every publish topic declared by an operation must exist in `subscriptions`.
- `type` is required when `fieldOperations` are defined.
- `subscriptions` entries can be `subscription({...})` or schema shorthand payloads.

## Related docs

- [operation](operation)
- [subscription](subscription)
- [fieldResolver](field-resolver)
