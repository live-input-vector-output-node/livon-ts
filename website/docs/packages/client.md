---
title: "@livon/client"
sidebar_position: 3
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fclient)](https://www.npmjs.com/package/@livon/client)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fclient?label=package%20size)](https://www.npmjs.com/package/@livon/client)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fclient?label=dependencies)](https://libraries.io/npm/%40livon%2Fclient)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)

## Purpose

[@livon/client](/docs/packages/client) provides deterministic client interface execution and generated-client foundations.

## Best for

Use this package when frontend apps consume generated LIVON APIs and typed subscription handlers.

Exports include:

- `createClient`
- `createClientModule`
- `clientModule`

## Generator sync policy

Generated client surfaces and hover docs are built from the client generator.
When generator output changes, docs must be updated in sync.

- Rule source: `packages/client/PROMPT.md`
- JSDoc reference: [SchemaDoc & Generated JSDoc](/docs/core/schema-doc-and-generated-jsdoc)

Current generated typing behavior to keep in sync:

- `and(...)` schema nodes are emitted as TypeScript intersections (`Left & Right`).
- If schema composition passes an explicit `name`, that name is used as the generated type name.

### Central TypeScript surface template

Generated interface and signature syntax is centralized in:

- `packages/client/src/typeScriptSurfaceTemplate.ts`

Use this file when TypeScript surface style should change globally (for example interface member syntax, callable signatures, or method/property signature formatting).
This avoids editing many render call sites in `packages/client/src/generate.ts`.

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

- [@livon/runtime](runtime)
- [@livon/client-ws-transport](client-ws-transport)
- [@livon/schema](schema)
- [SchemaDoc & Generated JSDoc](/docs/core/schema-doc-and-generated-jsdoc)
- [Schema APIs](/docs/schema)
