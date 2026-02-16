<!-- AUTO-GENERATED: run `pnpm docs:sync:package-readmes` -->
<!-- Source: website/docs/packages/node-ws-transport.md -->
# @livon/node-ws-transport

## Purpose

Node transport adapter for [@livon/runtime](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/runtime).  
It maps websocket wire envelopes to deterministic runtime envelopes.

## Install

```sh
pnpm add @livon/node-ws-transport
```

## Basic usage

```ts
import {runtime} from '@livon/runtime';
import {nodeWsTransport} from '@livon/node-ws-transport';

runtime(nodeWsTransport({server: wsServer}));
```

### Parameters in this example

`nodeWsTransport({...})`:

- `server` (`WebSocketServerLike`, required): websocket server instance from your host runtime.
- `onError` (`(error, info) => void`, optional): transport-level error callback.
- `getClientContext` (`(info) => RuntimeEventContext`, optional): maps client metadata to event context.
- `onClientClose` (`(info) => void`, optional): close callback for cleanup.
- `encode` (`(envelope) => Uint8Array`, optional): custom envelope encoder.
- `decode` (`(bytes) => envelope`, optional): custom envelope decoder.

## Runtime context fields

The transport enriches event context with:

- `transport: 'ws'`
- `clientId: string`

## Related pages

- [@livon/runtime](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/runtime)
- [@livon/client-ws-transport](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client-ws-transport)
- [Event Flow](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/event-flow)
