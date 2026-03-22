---
title: Packages Overview
sidebar_position: 1
---

LIVON packages live under `packages/*` and are documented here.
Use this page to choose the right package set for runtime, transport, reliability, and tooling.

## Module formats

Publishable runtime packages expose conditional exports for both ESM and CJS.
There is no separate `./mini` publish variant.

Example:

```ts
import {runtime} from '@livon/runtime';
const {runtime: runtimeCjs} = require('@livon/runtime');
```

`@livon/config` publishes tooling presets rather than runtime bundle variants.

## Core runtime stack

1. [@livon/runtime](runtime)
2. [@livon/schema](schema)
3. [@livon/client](client)
4. [@livon/client-ws-transport](client-ws-transport)
5. [@livon/node-ws-transport](node-ws-transport)
6. [@livon/sync](sync)
7. [@livon/react](react)

## Reliability and tooling

1. [@livon/dlq-module](dlq-module)
2. [@livon/config](config)
3. [@livon/cli](cli)

## Schema API reference

- [Schema APIs](/docs/schema)
