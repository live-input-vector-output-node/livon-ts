---
title: Getting Started
sidebar_position: 1
---

## Install

### Server runtime stack

```sh
pnpm add @livon/runtime @livon/schema @livon/node-ws-transport
```

### Client runtime stack

```sh
pnpm add @livon/runtime @livon/client @livon/client-ws-transport
```

### Optional tooling

```sh
pnpm add -D @livon/cli
```

## Minimal server composition

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

- `server` (`WebSocketServer`): websocket server instance bound to runtime transport.

`schemaModule(serverSchema, {explain})`:

- `serverSchema` (`SchemaModuleInput`): [schema](/docs/schema) contract adapter.
- `explain` (`boolean`): enables explain endpoint for [schema AST](/docs/schema) metadata.

## Minimal client composition

```ts
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {api} from './generated/api';

const transport = clientWsTransport({url: 'ws://localhost:3002/ws'});
runtime(transport, api);
```

### Parameters in this example

`clientWsTransport({url})`:

- `url` (`string`): websocket endpoint URL.

`runtime(transport, api)`:

- `transport` (`RuntimeModule`): client websocket transport module.
- `api` (`RuntimeModule`): generated client module.

## Simple message API with subscription

### 1. Define [schema contracts](/docs/schema) + server API

```ts
import {
  api,
  createSchemaModuleInput,
  object,
  operation,
  string,
  subscription,
} from '@livon/schema';

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
});

const onMessage = subscription({
  payload: message,
});

const serverApi = api({
  operations: {
    sendMessage,
  },
  subscriptions: {
    onMessage,
  },
});

export const serverSchema = createSchemaModuleInput(serverApi);
```

### Parameters in this example

`object({...})`:

- `name` (`string`): schema name.
- `shape` (`Record<string, Schema>`): field schema map.

`operation({...})`:

- `input` (`Schema`): operation request [schema](/docs/schema).
- `output` (`Schema`): operation response [schema](/docs/schema).
- `exec` (`(input, ctx) => result`): operation resolver.
- `publish` (`Record<string, (output) => payload>`): publish map by subscription topic.

`subscription({...})`:

- `payload` (`Schema`): subscription payload [schema](/docs/schema).

`api({...})`:

- `operations` (`Record<string, Operation>`): operation map.
- `subscriptions` (`Record<string, Subscription>`): subscription map.

`createSchemaModuleInput(serverApi)`:

- `serverApi` (`Api`): composed [schema API contract](/docs/schema/api).

### 2. Mount runtime on server

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

Same as in [Minimal server composition](#minimal-server-composition): `server`, `serverSchema`, and `explain`.

### 3. Use generated client API

```ts
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {createStore} from 'zustand/vanilla';
import {api} from './generated/api';

interface ChatState {
  messages: string[];
}

const chatStore = createStore<ChatState>((set) => {
  api({
    onMessage: (payload) =>
      set((state) => ({
        ...state,
        messages: [...state.messages, payload.text],
      })),
  });

  return {
    messages: [],
  };
});

const transport = clientWsTransport({url: 'ws://localhost:3002/ws'});

runtime(transport, api);

await api.sendMessage({
  author: 'Ada',
  text: 'Hello from LIVON',
});
```

### Parameters in this example

`createStore<ChatState>((set) => ...)`:

- `set` (`(updater) => void`): Zustand state setter.

`api({...})`:

- `onMessage` (`(payload) => void`): subscription callback used to update local state.

`set((state) => ({...}))`:

- `state` (`ChatState`): previous store snapshot for immutable update.

`clientWsTransport({url})`:

- `url` (`string`): websocket endpoint URL.

`api.sendMessage({...})`:

- `author` (`string`): message author id/name.
- `text` (`string`): message body.

## Generate client API from server [schema](/docs/schema)

```sh
livon --endpoint ws://localhost:3002/ws --out src/generated/api.ts --poll 2000
```

## State integration (Zustand)

```sh
pnpm add zustand
```

```ts
import {create} from 'zustand';
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {api} from './generated/api';

interface ChatState {
  messages: string[];
}

export const useChatStore = create<ChatState>((set) => {
  api({
    onMessage: (payload) =>
      set((state) => ({
        ...state,
        messages: [...state.messages, payload.text],
      })),
  });

  return {
    messages: [],
  };
});

const transport = clientWsTransport({url: 'ws://localhost:3002/ws'});

runtime(transport, api);
```

### Parameters in this example

`create<ChatState>((set) => ...)`:

- `set` (`(updater) => void`): Zustand setter.

`api({...})`:

- `onMessage` (`(payload) => void`): subscription callback mapped into state updates.

## State integration (Redux Toolkit)

```sh
pnpm add @reduxjs/toolkit react-redux
```

```ts
import {configureStore, createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {api} from './generated/api';

interface ChatState {
  messages: string[];
}

const chatSlice = createSlice({
  name: 'chat',
  initialState: {messages: []} as ChatState,
  reducers: {
    messageReceived: (state, action: PayloadAction<string>) => {
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    },
  },
});

export const store = configureStore({
  reducer: {
    chat: chatSlice.reducer,
  },
});

const transport = clientWsTransport({url: 'ws://localhost:3002/ws'});

api({
  onMessage: (payload) => {
    store.dispatch(chatSlice.actions.messageReceived(payload.text));
  },
});

runtime(transport, api);
```

### Parameters in this example

`createSlice({...})`:

- `name` (`string`): redux slice id.
- `initialState` (`ChatState`): initial reducer state.
- `reducers` (`Record<string, reducer>`): reducer map.

`messageReceived(state, action)`:

- `state` (`ChatState`): current reducer state.
- `action.payload` (`string`): message text payload.

`configureStore({...})`:

- `reducer` (`Record<string, reducer>`): root reducer map.

`api({...})`:

- `onMessage` (`(payload) => void`): subscription callback dispatching redux action.

## Next steps

1. Read [Architecture](../technical/architecture) for runtime/message flow.
2. Read [@livon/client](../packages/client) for more `zustand` and `redux` integration patterns.
3. Read [@livon/schema](../packages/schema) for operation/subscription modeling.
