---
title: "fieldResolver"
sidebar_position: 19
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/schema/badge.svg)](https://snyk.io/test/npm/@livon/schema)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

In LIVON, `fieldResolver` is implemented with `fieldOperation`.

Use `fieldOperation` for type-safe field-level resolvers that depend on an entity schema.

```ts
import {fieldOperation, object, string} from '@livon/schema';

const User = object({
  name: 'User',
  shape: {
    id: string(),
    name: string(),
  },
});

const GreetingOutput = string();

const userGreetingResolver = fieldOperation({
  dependsOn: User,
  output: GreetingOutput,
  exec: async (entity) => `Hello ${entity.name}`,
});
```

Key points:

- `dependsOn` can be a schema or a shape
- `output` is optional but recommended for strict typing
- `api.type` is required when `fieldOperations` are used

`dependsOn`, `input`, and `output` can use any value schema from this section.  
API schemas (`api`) are not valid as field resolver schemas.

## Parameters

- `dependsOn` (`Schema | Shape`, required): source entity schema (or shape shorthand).
- `input` (`Schema | Shape`, optional): resolver input schema.
- `output` (`Schema`, optional): resolver output schema.
- `exec` (`(dependsOn, ctx) => result | Promise<result>` or `(dependsOn, input, ctx) => result | Promise<result>`, required): resolver function.
- `doc` (`SchemaDoc`, optional): field resolver metadata.

## Chain API

- `fieldOperation` does not expose schema chain methods (`return type: FieldOperation<...>`, not `Schema<T>`).
- Use value schemas for `dependsOn`, `input`, and `output` where chain methods are available.

## Related docs

- [api](api)
- [operation](operation)
- [subscription](subscription)
- [Schema APIs](/docs/schema)
