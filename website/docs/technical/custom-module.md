---
title: How To Make Custom Module
sidebar_position: 5
---

For runtime integrators, this page shows how to build and mount custom runtime modules safely.

## Step 1: define module factory

```ts
import type {RuntimeModule} from '@livon/runtime';

interface TraceModuleInput {
  moduleName: string;
}

export const traceModule = ({moduleName}: TraceModuleInput): RuntimeModule => ({
  name: moduleName,
  register: ({onReceive, onSend, onError}) => {
    onReceive(async (envelope, ctx, next) => {
      return next();
    });

    onSend(async (envelope, ctx, next) => {
      return next();
    });

    onError((error, envelope) => {
      console.error('traceModule.onError', {
        event: envelope.event,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  },
});
```

### Parameters in this example

`traceModule({moduleName})`:

- `moduleName` (`string`): module identifier used as runtime module name.

`onReceive((envelope, ctx, next) => ...)` and `onSend((envelope, ctx, next) => ...)`:

- `envelope` (`EventEnvelope`): current event envelope.
- `ctx` (`RuntimeContext`): runtime context for emit/state/room APIs.
- `next` (`(update?) => Promise<EventEnvelope>`): proceeds to next hook, optional envelope update.

`onError((error, envelope) => ...)`:

- `error` (`unknown`): hook/runtime error.
- `envelope` (`EventEnvelope`): failed event envelope snapshot.

## Step 2: mount module in runtime composition

```ts
import {runtime} from '@livon/runtime';
import {schemaModule} from '@livon/schema';
import {nodeWsTransport} from '@livon/node-ws-transport';
import {traceModule} from './traceModule.js';

runtime(
  nodeWsTransport({server: wsServer}),
  traceModule({moduleName: 'trace'}),
  schemaModule(serverSchema, {explain: true}),
);
```

### Parameters in this example

`nodeWsTransport({server})`:

- `server` (`WebSocketServer`): websocket server instance bound to runtime.

`schemaModule(serverSchema, {explain})`:

- `serverSchema` (`Api | ComposedApi`): [schema](/docs/schema) runtime input returned by `api(...)` or `composeApi(...)`.
- `explain` (`boolean`): enables explain endpoint for [schema AST](/docs/schema) metadata.

## Module schema rules

1. Communicate only via runtime channels (`emit*`, `onReceive`, `onSend`, `onError`).
2. Do not assume other modules exist.
3. Keep envelope handling immutable.
4. Keep module responsibility narrow (transport, [schema](/docs/schema), reliability, metrics, etc.).
