---
title: "@livon/dlq-module"
sidebar_position: 6
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fdlq-module)](https://www.npmjs.com/package/@livon/dlq-module)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/dlq-module/badge.svg)](https://snyk.io/test/npm/@livon/dlq-module)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
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
