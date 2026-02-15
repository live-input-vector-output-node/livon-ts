---
title: "@livon/node-ws-transport"
sidebar_position: 5
---

[![node-ws size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-node-ws-transport.json)](https://www.npmjs.com/package/@livon/node-ws-transport)

## Install

```sh
pnpm add @livon/node-ws-transport ws
```

## Purpose

Node.js websocket transport module for [@livon/runtime](/docs/packages/runtime).

It binds a `WebSocketServer` to runtime hooks and translates wire envelopes to runtime envelopes.

## Basic usage

```ts
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {runtime} from '@livon/runtime';
import {nodeWsTransport} from '@livon/node-ws-transport';

const server = createServer();
const wsServer = new WebSocketServer({server, path: '/ws'});

runtime(nodeWsTransport({server: wsServer}));
```

## Parameters

`nodeWsTransport({...})`:

- `server` (`WebSocketServer`, required): websocket server instance bound to runtime transport.
- `onError` (`(error, info) => void`, optional): transport-level error callback.
- `getClientContext` (`(info) => RuntimeEventContext`, optional): maps connection/client info into envelope context.
- `onClientClose` (`(info) => void`, optional): close callback for cleanup and custom side effects.
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
