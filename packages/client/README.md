# @livon/client

[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Code Quality](https://img.shields.io/badge/code%20quality-eslint%20%2B%20tsc-1f6feb)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![npm](https://img.shields.io/npm/v/%40livon%2Fclient)](https://www.npmjs.com/package/@livon/client)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-client.json)](https://www.npmjs.com/package/@livon/client)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](../../LIZENZ.md)

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
