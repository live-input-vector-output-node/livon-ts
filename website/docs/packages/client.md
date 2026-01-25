---
title: "@livon/client"
sidebar_position: 3
---

## Install

```sh
pnpm add @livon/client
```

## Purpose

[@livon/client](/docs/packages/client) provides the runtime client module and generated-client foundations.

Exports include:

- `createClient`
- `createClientModule`
- `clientModule`

## Runtime wiring (generated API path)

```ts
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {api} from './generated/api';

const transport = clientWsTransport({url: 'ws://localhost:3002/ws'});
runtime(transport, api);
```

### Parameters in this example

`clientWsTransport({...})`:

- `url` (`string`): websocket endpoint for the LIVON server.

`runtime(transport, api)`:

- `transport` (`RuntimeModule`): client transport module.
- `api` (`RuntimeModule`): generated client module.

## Subscription handling pattern

```ts
api({
  onMessage: (payload, ctx) => {
    // payload typed from generated schema
  },
});

api.onMessage.off();
```

### Parameters in this example

`api({...})`:

- `onMessage` (`(payload, ctx) => void`): handler callback for subscription `onMessage`.
- `payload` (in callback): typed subscription payload from generated [schema](/docs/schema).
- `ctx` (in callback): runtime context for emit/state/room access.

`api.onMessage.off()`:

- no parameters; disables delivery for one subscription.
- subscriptions are enabled by default when handler is registered via `api({...})`.

## Zustand integration pattern

```ts
import {create} from 'zustand';
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
```

### Parameters in this example

`create<ChatState>((set) => ...)`:

- `set` (`(updater) => void`): Zustand state setter.

`set((state) => ({...state, messages: [...] }))`:

- `state` (`ChatState`): previous state snapshot used for immutable update.

`api({...})`:

- `onMessage` (`(payload) => void`): callback to forward subscription payload into store state.

## Redux Toolkit integration pattern

```ts
import {configureStore, createSlice, type PayloadAction} from '@reduxjs/toolkit';

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

api({
  onMessage: (payload) => {
    store.dispatch(chatSlice.actions.messageReceived(payload.text));
  },
});
```

### Parameters in this example

`createSlice({...})`:

- `name` (`string`): redux slice name.
- `initialState` (`ChatState`): initial store segment state.
- `reducers` (`Record<string, reducer>`): reducer map for state transitions.

`messageReceived(state, action)`:

- `state` (`ChatState`): current reducer state.
- `action.payload` (`string`): message text dispatched from subscription callback.

`api({...})`:

- `onMessage` (`(payload) => void`): subscription callback dispatching into redux store.

## Room-scoped handlers

```ts
api.room('global')({
  onMessage: (payload) => {
    // room-specific handling
  },
});
```

### Parameters in this example

`api.room(roomId)`:

- `roomId` (`string`): room scope for handler registration.

`api.room(... )({...})`:

- `onMessage` (`(payload) => void`): room-scoped subscription callback.

## Low-level client module

If you need direct control over AST-driven client behavior:

```ts
import {createClientModule} from '@livon/client';

const clientModule = createClientModule({ast});
runtime(transport, clientModule);
```

### Parameters in this example

`createClientModule({...})`:

- `ast` (`AstNode`): [schema AST](/docs/schema) used to build low-level client contract behavior.

## Related pages

- [@livon/runtime](runtime)
- [@livon/client-ws-transport](client-ws-transport)
- [@livon/schema](schema)
- [Schema APIs](/docs/schema)
