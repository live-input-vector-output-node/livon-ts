# @livon/dlq-module

[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Code Quality](https://img.shields.io/badge/code%20quality-eslint%20%2B%20tsc-1f6feb)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![npm](https://img.shields.io/npm/v/%40livon%2Fdlq-module)](https://www.npmjs.com/package/@livon/dlq-module)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-dlq-module.json)](https://www.npmjs.com/package/@livon/dlq-module)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](../../LIZENZ.md)

## Install

```sh
pnpm add @livon/dlq-module
```

## Purpose

[@livon/dlq-module](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/dlq-module) listens to [runtime](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/runtime) `onError` events, tracks retry attempts in event context, and replays events until `maxAttempts` is reached.

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

- [@livon/runtime](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/runtime)
- [Event Flow](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/event-flow)
- [Architecture](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/architecture)
