---
title: "api"
sidebar_position: 17
---

`api({...})` composes your schema contracts into one API contract.

## Minimal usage

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
```

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
