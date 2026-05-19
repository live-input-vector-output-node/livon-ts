---
title: Packages Overview
sidebar_position: 1
---

LIVON packages live under `packages/*` and are documented here.
Use this page to choose the right package set for runtime, transport, client sync, framework adapters, reliability, and tooling.

## Module formats

Publishable runtime packages expose conditional exports for both ESM and CJS.
There is no separate `./mini` publish variant.

Example:

```ts
import {runtime} from '@livon/runtime';
const {runtime: runtimeCjs} = require('@livon/runtime');
```

## Core runtime stack

1. [@livon/runtime](runtime)
2. [@livon/schema](schema)
3. [@livon/client](client)
4. [@livon/contract](contract)
5. [@livon/client-sync](client-sync)
6. [@livon/client-ws-transport](client-ws-transport)
7. [@livon/node-ws-transport](node-ws-transport)
8. [@livon/sync](sync)
9. [@livon/react](react)

## Client sync plugins

Client generation is plugin-based only.
Client repositories install a Livon build plugin, configure a WebSocket `$explain` URL, and import from the configured generated alias.

1. [@livon/plugin](plugin)
2. [@livon/plugin-rsbuild](plugin-rsbuild)

## Framework adapter boundary

`@livon/sync` is the shared sync core that keeps state, caching, and tracking framework-agnostic.
`@livon/react` is the React framework adapter that consumes tracked sync units.

- Keep shared sync behavior in `@livon/sync`.
- Keep React-only integration in `@livon/react`.

## Reliability and tooling

1. [@livon/dlq-module](dlq-module)
2. [@livon/cli](cli) compatibility stub

## Schema API reference

- [Schema APIs](/docs/schema)
