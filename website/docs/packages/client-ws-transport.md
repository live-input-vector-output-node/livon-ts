---
title: "@livon/client-ws-transport"
sidebar_position: 4
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fclient-ws-transport)](https://www.npmjs.com/package/@livon/client-ws-transport)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fclient-ws-transport?label=dependencies)](https://libraries.io/npm/%40livon%2Fclient-ws-transport)
[![npm publish](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/publish.yml?branch=main&label=npm%20publish)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![Snyk security](https://snyk.io/test/npm/@livon/client-ws-transport/badge.svg)](https://snyk.io/test/npm/@livon/client-ws-transport)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fclient-ws-transport?label=package%20size)](https://www.npmjs.com/package/@livon/client-ws-transport)
[![license](https://img.shields.io/npm/l/%40livon%2Fclient-ws-transport)](https://www.npmjs.com/package/@livon/client-ws-transport)

## Purpose

Browser/client websocket transport module for [@livon/runtime](/docs/packages/runtime).

## Best for

Use this package when browser clients need reliable request/response messaging over WebSocket.

## Install

```sh
pnpm add @livon/client-ws-transport
```

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

- [@livon/runtime](runtime)
- [@livon/client](client)
- [@livon/node-ws-transport](node-ws-transport)
- [Architecture](/docs/technical/architecture)
