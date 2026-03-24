---
title: "@livon/dlq-module"
sidebar_position: 6
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fdlq-module)](https://www.npmjs.com/package/@livon/dlq-module)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fdlq-module?label=dependencies)](https://libraries.io/npm/%40livon%2Fdlq-module)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/dlq-module/badge.svg)](https://snyk.io/test/npm/@livon/dlq-module)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fdlq-module?label=package%20size)](https://www.npmjs.com/package/@livon/dlq-module)
[![license](https://img.shields.io/npm/l/%40livon%2Fdlq-module)](https://www.npmjs.com/package/@livon/dlq-module)

## Purpose

[@livon/dlq-module](/docs/packages/dlq-module) listens to [runtime](/docs/packages/runtime) `onError` events, tracks retry attempts in event context, and replays events until `maxAttempts` is reached.

## Best for

Use this module when you need retry control and dead-letter handling for failed runtime events.

## Install

```sh
pnpm add @livon/dlq-module
```

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
