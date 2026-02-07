---
title: "operation"
sidebar_position: 17
---

`operation` defines a request/response handler in your API schema.

```ts
import {object, operation, string} from '@livon/schema';

const messageInput = object({
  name: 'MessageInput',
  shape: {
    author: string(),
    text: string(),
  },
});

const message = object({
  name: 'Message',
  shape: {
    author: string(),
    text: string(),
  },
});

const sendMessage = operation({
  input: messageInput,
  output: message,
  exec: async (input) => input,
  publish: {
    onMessage: (output) => output,
  },
  rooms: (input) => (input.author === 'system' ? 'admin-room' : 'global'),
  ack: {required: true, mode: 'received', timeoutMs: 5000, retries: 3},
});
```

Key fields:

- `input`: request schema
- `output`: response schema (optional)
- `exec`: operation implementation
- `publish`: topic callbacks for subscriptions
- `rooms`: dynamic room routing
- `ack`: delivery acknowledgement config

`input` and `output` can use any value schema from this section.  
API contracts (`api`) are not valid as `input` or `output`.

Important: every publish topic must exist in `api(...).subscriptions`.

## Parameters

- `input` (`Schema`, required): request schema.
- `output` (`Schema`, optional): response schema.
- `exec` (`(input, ctx) => result | Promise<result>`, required): operation executor.
- `publish` (`Record<string, (output, ctx) => payload>`, optional): publish map by subscription topic.
- `rooms` (`(input, ctx) => string | string[] | undefined`, optional): room routing.
- `ack` (`boolean | AckConfig`, optional): publish acknowledgement behavior.
- `doc` (`SchemaDoc`, optional): operation metadata.

## Chain API

- `operation` does not expose schema chain methods (`return type: Operation<...>`, not `Schema<T>`).
- Compose operation output with schema builders (`object`, `union`, `or`, `before`, `after`, `and`, etc.).

## Related docs

- [api](api)
- [subscription](subscription)
- [fieldResolver](field-resolver)
- [Schema APIs](/docs/schema)
