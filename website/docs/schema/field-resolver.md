---
title: "fieldResolver"
sidebar_position: 19
---

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
