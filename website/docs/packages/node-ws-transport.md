---
title: "@livon/node-ws-transport"
sidebar_position: 5
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fnode-ws-transport)](https://www.npmjs.com/package/@livon/node-ws-transport)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fnode-ws-transport?label=dependencies)](https://libraries.io/npm/%40livon%2Fnode-ws-transport)
[![npm publish](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/publish.yml?branch=main&label=npm%20publish)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![Snyk security](https://snyk.io/test/npm/@livon/node-ws-transport/badge.svg)](https://snyk.io/test/npm/@livon/node-ws-transport)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fnode-ws-transport?label=package%20size)](https://www.npmjs.com/package/@livon/node-ws-transport)
[![license](https://img.shields.io/npm/l/%40livon%2Fnode-ws-transport)](https://www.npmjs.com/package/@livon/node-ws-transport)

## Purpose

Node transport adapter for [@livon/runtime](/docs/packages/runtime).  
It maps websocket wire envelopes to deterministic runtime envelopes.

## Best for

Use this package when backend services expose LIVON over WebSocket.

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

- [@livon/runtime](runtime)
- [@livon/client-ws-transport](client-ws-transport)
- [Event Flow](/docs/technical/event-flow)
