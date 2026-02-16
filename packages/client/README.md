# @livon/client

## Purpose

[@livon/client](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client) provides deterministic client interface execution and generated-client foundations.

Exports include:

- `createClient`
- `createClientModule`
- `clientModule`

## Install

```sh
pnpm add @livon/client
```

## Runtime wiring (generated API path)

```ts
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {api} from './generated/api';

runtime(
  clientWsTransport({url: 'ws://127.0.0.1:3002/ws'}),
  api,
);
```

### Parameters in this example

`clientWsTransport({...})`:

- `url` (`string`): websocket endpoint used by client transport.

`runtime(transport, api)`:

- `transport` (`RuntimeModule`): client transport module.
- `api` (`RuntimeModule`): generated client module built from server schema.

## Subscription handling pattern

```ts
api({
  onMessage: (payload, ctx) => {
    payload.text;
    ctx.state.get('lastMessage');
  },
});

api.onMessage.off();
```

### Parameters in this example

`api({...})`:

- `onMessage` (`(payload, ctx) => void`): typed subscription callback.
- `payload` (in callback): generated payload type from server schema.
- `ctx` (in callback): runtime context for state/emit/room access.

`api.onMessage.off()`:

- no parameters; disables one subscription callback stream.

## Room-scoped handlers

```ts
api.room('global')({
  onMessage: (payload) => {
    payload.text;
  },
});
```

### Parameters in this example

`api.room(roomId)`:

- `roomId` (`string`): room selector for scoped schema handling.

`api.room(... )({...})`:

- `onMessage` (`(payload) => void`): room-scoped subscription callback.

## Low-level client module

```ts
import {createClientModule} from '@livon/client';
import {runtime} from '@livon/runtime';

const module = createClientModule({ast});
runtime(transport, module);
```

### Parameters in this example

`createClientModule({...})`:

- `ast` (`AstNode`): schema AST used to build executable client interface module.

## Related pages

- [@livon/runtime](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/runtime)
- [@livon/client-ws-transport](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client-ws-transport)
- [@livon/schema](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/schema)
- [Schema APIs](https://live-input-vector-output-node.github.io/livon-ts/docs/schema)
