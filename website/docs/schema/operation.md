---
title: "operation"
sidebar_position: 17
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


Use `operation` to define request/response handlers in your API schema.

```ts
import {and, literal, object, operation, or, string, union} from '@livon/schema';

const MessagePayload = union({
  name: 'MessagePayload',
  options: [
    string().min(1),
    object({
      name: 'AttachmentPayload',
      shape: {
        url: string(),
      },
    }),
  ],
});

const RoomTarget = or({
  name: 'RoomTarget',
  options: [literal({name: 'GlobalRoom', value: 'global'}), string()],
});

const MessageInput = object({
  name: 'MessageInput',
  shape: {
    author: string(),
    payload: MessagePayload,
    room: RoomTarget,
  },
});

const WithId = object({
  name: 'WithId',
  shape: {
    id: string(),
  },
});

const Message = and({
  left: MessageInput,
  right: WithId,
  name: 'Message',
});

const sendMessage = operation({
  input: MessageInput,
  output: Message,
  exec: async (input) => ({...input, id: 'msg-1'}),
  publish: {
    onMessage: (output) => output,
  },
  rooms: (input) => (input.room === 'global' ? 'global' : input.room),
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

This example intentionally composes `Message` from `MessageInput + WithId` (`and`) so you do not redefine the same payload fields twice.

`input` and `output` can use any value schema from this section.  
API schemas (`api`) are not valid as `input` or `output`.

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
