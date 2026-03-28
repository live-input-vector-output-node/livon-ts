---
title: "api"
sidebar_position: 17
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/schema/badge.svg)](https://snyk.io/test/npm/@livon/schema)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

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
- [fieldOperation](field-operation)
