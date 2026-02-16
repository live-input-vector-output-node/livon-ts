# @livon/client-ws-transport

## Install

```sh
pnpm add @livon/client-ws-transport
```

## Purpose

Browser/client websocket transport module for [@livon/runtime](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/runtime).

It provides:

- request/response correlation
- reconnect behavior
- optional queueing for pending outbound requests
- transport-level error callbacks

## Basic usage

```ts
import {runtime} from '@livon/runtime';
import {clientWsTransport} from '@livon/client-ws-transport';
import {api} from './generated/api';

const transport = clientWsTransport({
  url: 'ws://127.0.0.1:3002/ws',
  reconnect: true,
  reconnectDelayMs: 1000,
  queueEnabled: true,
});

runtime(transport, api);
```

## Parameters

`clientWsTransport({...})`:

- `url` (`string`, required): websocket endpoint URL.
- `protocols` (`string | string[]`, optional): websocket subprotocols to request.
- `requestTimeoutMs` (`number`, optional): timeout for request/response correlation before failing pending request.
- `reconnect` (`boolean`, optional): enables reconnect behavior after disconnect.
- `reconnectDelayMs` (`number`, optional): wait time between reconnect attempts.
- `reconnectPollIntervalMs` (`number`, optional): polling interval when checking server reachability for reconnect.
- `queueEnabled` (`boolean`, optional): enables outbound queue when socket is not writable.
- `queueMaxSize` (`number`, optional): max queued outbound events.
- `queueDropOldest` (`boolean`, optional): drops oldest queued event when max size is reached.
- `onError` (`(error, info) => void`, optional): transport-level error callback.
- `encode` (`(envelope) => Uint8Array`, optional): custom envelope encoder.
- `decode` (`(bytes) => envelope`, optional): custom envelope decoder.

## Notes

- Payloads are binary (`Uint8Array`) over the wire.
- Correlation IDs are stored in envelope metadata.

## Related pages

- [@livon/runtime](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/runtime)
- [@livon/client](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client)
- [@livon/node-ws-transport](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/node-ws-transport)
- [Architecture](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/architecture)
