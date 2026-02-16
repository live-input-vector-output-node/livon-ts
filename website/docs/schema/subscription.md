---
title: "subscription"
sidebar_position: 18
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


Use `subscription` to validate published payloads and optionally transform them.

```ts
import {and, boolean, literal, object, string, subscription, union} from '@livon/schema';

const MessageBase = object({
  name: 'MessageBase',
  shape: {
    author: string(),
    text: string(),
  },
});

const WithRoom = object({
  name: 'WithRoom',
  shape: {
    room: string(),
  },
});

const Message = and({
  left: MessageBase,
  right: WithRoom,
  name: 'Message',
});

const SubscriptionInput = object({
  name: 'SubscriptionInput',
  shape: {
    author: union({
      name: 'TargetAuthor',
      options: [literal({name: 'AnyAuthor', value: '*'}), string()],
    }),
  },
});

const WithTrimMeta = object({
  name: 'WithTrimMeta',
  shape: {
    trimmed: boolean(),
  },
});

const SubscriptionOutput = and({
  left: MessageBase,
  right: WithTrimMeta,
  name: 'SubscriptionOutput',
});

const onMessage = subscription({
  input: SubscriptionInput,
  payload: Message,
  output: SubscriptionOutput,
  filter: (input, payload) => input.author === '*' || input.author === payload.author,
  exec: async (_input, payload) => ({
    author: payload.author,
    text: payload.text.trim(),
    trimmed: true,
  }),
});
```

Key fields:

- `payload`: required payload schema
- `input`: optional subscription input schema
- `output`: optional transformed output schema
- `filter`: optional gate (`boolean`)
- `exec`: optional transform resolver

This example uses composition (`and`, `union`) to avoid duplicate object schema definitions across input/payload/output.

`input`, `payload`, and `output` can use any value schema from this section.  
API schemas (`api`) are not valid as subscription schemas.

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
