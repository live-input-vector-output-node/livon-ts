---
title: Getting Started
sidebar_position: 1
---

This guide sets up a minimal stack with only `@livon/*` packages.

## Before you start: generated client requires plugin sync

For the generated client workflow (`import {api} from '@livon/generated'`), configure a Livon build plugin.
Client generation is plugin-based only; the client repository does not need access to the server repository.

## Install

### Server runtime stack

```sh
pnpm add @livon/runtime @livon/schema @livon/node-ws-transport
```

### Client runtime stack

```sh
pnpm add @livon/runtime @livon/client
```

### Required for generated client workflow

```sh
pnpm add -D @livon/plugin-rsbuild
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
- `explain` (`boolean`): exposes schema explain metadata for plugin-based client sync.

## 3. Configure client API sync (required)

```ts
import {defineConfig} from '@rsbuild/core';
import {livonClientSyncPlugin} from '@livon/plugin-rsbuild';

export default defineConfig({
  plugins: [
    livonClientSyncPlugin({
      url: 'ws://127.0.0.1:3002/ws',
      outputDirectory: '.livon/generated',
      importIdentifier: '@livon/generated',
      failureMode: 'warnAndUseCache',
      syncMode: 'startup',
    }),
  ],
});
```

### Parameters in this example

`livonClientSyncPlugin({...})`:

- `url` (`string`): WebSocket endpoint used to fetch `$explain` metadata.
- `outputDirectory` (`string`): generated client cache directory.
- `importIdentifier` (`string`): alias used by app imports.
- `failureMode` (`string`): cache behavior when sync fails.
- `syncMode` (`string`): lifecycle phase used for sync.

### Why this step is required

`@livon/client-sync` emits physical generated files consumed by TypeScript and the browser build.
This keeps operation/subscription signatures structurally aligned with the server schema.

## 4. Mount client runtime and call operation

```ts
import {configureLivonClient} from '@livon/client';
import {api} from '@livon/generated';

configureLivonClient({endpointUrl: 'ws://127.0.0.1:3002/ws'});

api({
  onMessage: (payload) => {
    payload.id;
  },
});

await api.sendMessage({author: 'Alice', text: 'Hello', roomId: 'global'});
```

### Parameters in this example

`configureLivonClient({endpointUrl})`:

- `url` (`string`): websocket endpoint URL.

`api({onMessage})`:

- `onMessage` (`(payload) => void`): typed subscription callback.

`api.sendMessage(input)`:

- `input` (`MessageInput`): typed operation input generated from server schema.

## 5. Run required processes

Keep these processes running during development:

1. server runtime process (with `schemaModule(..., {explain: true})`)
2. client build/dev process with the Livon plugin configured

## 6. Minimal troubleshooting

If client API usage fails, check in this order:

1. `schemaModule(..., {explain: true})` is enabled.
2. plugin `url` points to the same WebSocket endpoint your client runtime uses.
3. generated files under `.livon/generated` exist and are current.

## Next steps

- [Validated by Default](validated-by-default)
- [parse vs typed](parse-vs-typed)
- [@livon/plugin-rsbuild](../packages/plugin-rsbuild)
- [Schema APIs](/docs/schema)
