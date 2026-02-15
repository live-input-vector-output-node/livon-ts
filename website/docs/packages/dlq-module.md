---
title: "@livon/dlq-module"
sidebar_position: 6
---

[![dlq size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-dlq-module.json)](https://www.npmjs.com/package/@livon/dlq-module)

## Install

```sh
pnpm add @livon/dlq-module
```

## Purpose

[@livon/dlq-module](/docs/packages/dlq-module) listens to [runtime](/docs/packages/runtime) `onError` events, tracks retry attempts in event context, and replays events until `maxAttempts` is reached.

## Basic usage

```ts
import {dlqModule} from '@livon/dlq-module';

runtime(
  dlqModule({
    maxAttempts: 5,
    storeBrokenEvent: async (brokenEvent) => {
      await db.dlq.insertOne(brokenEvent);
    },
    countPendingEvents: async () => db.dlq.countPending(),
    loadReadyEvents: async () => db.dlq.loadReady(),
  }),
);
```

## Parameters

`dlqModule({...})`:

- `maxAttempts` (`number`, required): max retry count before event is finalized as failed.
- `storeBrokenEvent` (`(brokenEvent) => Promise<void>`, required): persists failed events (including updated context).
- `countPendingEvents` (`() => number | Promise<number>`, required): returns pending replay count; ticker stops when `<= 0`.
- `loadReadyEvents` (`() => EventEnvelope[] | Promise<EventEnvelope[]>`, required): loads events ready to replay in current tick.

Callback parameter details:

- `brokenEvent` (`EventEnvelope`): failed event with `context.dlq` metadata and timestamp fields.

## Context enrichment

Module adds:

```ts
context.dlq = {
  attempts,
  maxAttempts,
  firstErrorAt,
  lastErrorAt,
  final,
};
```

## Replay behavior

- status `receiving` events replay via `emitReceive`
- status `sending` events replay via `emitSend`
- final failures remain `failed` and are not replayed

## Related pages

- [@livon/runtime](runtime)
- [Event Flow](/docs/technical/event-flow)
- [Architecture](/docs/technical/architecture)
