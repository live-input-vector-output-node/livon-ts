---
title: Getting Started
sidebar_position: 1
---

This guide sets up a minimal stack with only `@livon/*` packages.

## Before you start: generated client requires sync

For the generated client workflow (`import {api} from './generated/api'`), `@livon/cli` sync is required.
If sync is not running (or has never run), your generated client API file is missing or outdated.

## Install

### Server runtime stack

```sh
pnpm add @livon/runtime @livon/schema @livon/node-ws-transport
```

### Client runtime stack

```sh
pnpm add @livon/runtime @livon/client @livon/client-ws-transport
```

### Required for generated client workflow

```sh
pnpm add -D @livon/cli
```

## 1. Define schema once

Use schema composition (`and`, `union`, `or`) so you can extend schemas without duplicating field definitions.

```ts
import {
  and,
  api,
  literal,
  object,
  operation,
  or,
  string,
  subscription,
  union,
} from '@livon/schema';

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
    author: string().min(2),
    payload: MessagePayload,
    room: RoomTarget,
  },
  doc: {
    summary: 'Chat message payload',
    example: {author: 'Alice', payload: 'Hello', room: 'global'},
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
});

const ChatApi = api({
  operations: {sendMessage},
  subscriptions: {
    onMessage: subscription({payload: Message}),
  },
});

export const serverSchema = ChatApi;
```

`serverSchema` is used directly by `schemaModule(...)`.
No extra schema-module input adapter is required.

### Parameters in this example

`object({...})`:

- `name` (`string`): schema name.
- `shape` (`Record<string, Schema>`): payload fields.
- `doc` (`SchemaDoc`, optional): summary/example metadata used by generated docs.

`and({...})`:

- `left` (`Schema`): reusable base schema.
- `right` (`Schema`): additive schema.
- `name` (`string`, optional): composed schema name used in generated client types.

`union({...})` / `or({...})`:

- `options` (`Schema[]`): multiple allowed variants without duplicating object definitions.

`operation({...})`:

- `input` (`Schema`): receive boundary schema.
- `output` (`Schema`): send boundary schema.
- `exec` (`(input, ctx) => result`): operation logic with validated input.
- `publish` (`Record<string, (output) => payload>`): publish mapping for subscription topics.

`api({...})`:

- `operations` (`Record<string, Operation>`): operation map.
- `subscriptions` (`Record<string, Subscription>`): subscription map.

## 2. Mount server runtime

```ts
import {runtime} from '@livon/runtime';
import {schemaModule} from '@livon/schema';
import {nodeWsTransport} from '@livon/node-ws-transport';

runtime(
  nodeWsTransport({server: wsServer}),
  schemaModule(serverSchema, {explain: true}),
);
```

### Parameters in this example

`nodeWsTransport({server})`:

- `server` (`WebSocketServerLike`): websocket server instance from your host runtime.

`schemaModule(serverSchema, {explain})`:

- `serverSchema` (`Api | ComposedApi`): executable schema bundle from `api(...)` or `composeApi(...)`.
- `explain` (`boolean`): exposes schema explain metadata for client generation.

## 3. Start client API sync (required)

```sh
livon \
  --endpoint ws://127.0.0.1:3002/ws \
  --out src/generated/api.ts \
  --poll 2000 \
  -- pnpm dev
```

### Parameters in this example

`livon --endpoint ... --out ... --poll ... -- <command>`:

- `--endpoint` (`string`): endpoint used to fetch explain metadata.
- `--out` (`string`): generated client module output path.
- `--poll` (`number`): repeat interval in milliseconds.
- `--` (delimiter): separates LIVON flags from the linked command.
- `<command>` (`string`): starts your app process after sync starts (for example `pnpm dev`).

### Why this step is required

`@livon/client` in generated mode consumes schema code emitted by the sync process.
This keeps operation/subscription signatures structurally aligned with the server schema.
LIVON is kill-all by design in linked mode: if sync exits, the linked command is terminated; if the linked command exits, LIVON exits.

## 4. Mount client runtime and call operation

```ts
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {api} from './generated/api';

runtime(
  clientWsTransport({url: 'ws://127.0.0.1:3002/ws'}),
  api,
);

api({
  onMessage: (payload) => {
    payload.id;
  },
});

await api.sendMessage({author: 'Alice', payload: 'Hello', room: 'global'});
```

### Parameters in this example

`clientWsTransport({url})`:

- `url` (`string`): websocket endpoint URL.

`api({onMessage})`:

- `onMessage` (`(payload) => void`): typed subscription callback.

`api.sendMessage(input)`:

- `input` (`MessageInput`): typed operation input generated from server schema.

## 5. Run required processes

Keep these processes running during development:

1. server runtime process (with `schemaModule(..., {explain: true})`)
2. one linked process that runs sync and your app command together (`livon ... -- pnpm dev`)

In linked mode, process lifecycle is shared (kill-all semantics).

## 6. Minimal troubleshooting

If client API usage fails, check in this order:

1. `schemaModule(..., {explain: true})` is enabled.
2. `livon --endpoint ...` points to the same endpoint your client transport uses.
3. generated output file from `--out` exists and is current.

## Next steps

- [Validated by Default](validated-by-default)
- [parse vs typed](parse-vs-typed)
- [@livon/cli](../packages/cli)
- [Schema APIs](/docs/schema)
