---
title: "subscription"
sidebar_position: 18
---

`subscription` defines how published payloads are validated and optionally transformed.

```ts
import {object, string, subscription} from '@livon/schema';

const message = object({
  name: 'Message',
  shape: {
    author: string(),
    text: string(),
  },
});

const subscriptionInput = object({
  name: 'SubscriptionInput',
  shape: {
    author: string(),
  },
});

const subscriptionOutput = object({
  name: 'SubscriptionOutput',
  shape: {
    author: string(),
    text: string(),
  },
});

const onMessage = subscription({
  input: subscriptionInput,
  payload: message,
  output: subscriptionOutput,
  filter: (input, payload) => input.author === payload.author,
  exec: async (_input, payload) => ({
    ...payload,
    text: payload.text.trim(),
  }),
});
```

Key fields:

- `payload`: required payload schema
- `input`: optional subscription input schema
- `output`: optional transformed output schema
- `filter`: optional gate (`boolean`)
- `exec`: optional transform resolver

`input`, `payload`, and `output` can use any value schema from this section.  
API contracts (`api`) are not valid as subscription schemas.

## Parameters

- `payload` (`Schema`, required): published payload schema.
- `input` (`Schema`, optional): subscriber input schema.
- `output` (`Schema`, optional): transformed output schema.
- `filter` (`(input, payload, ctx) => boolean | Promise<boolean>`, optional): routing/filter gate.
- `exec` (`(input, payload, ctx) => result | Promise<result>`, optional): transform resolver.
- `name` (`string`, optional): explicit subscription name.
- `doc` (`SchemaDoc`, optional): subscription metadata.

## Chain API

- `subscription` does not expose schema chain methods (`return type: Subscription<...>`, not `Schema<T>`).
- Use regular value schemas for `input`, `payload`, and `output` where chain methods are available.

## Related docs

- [api](api)
- [operation](operation)
- [fieldResolver](field-resolver)
- [Schema APIs](/docs/schema)
