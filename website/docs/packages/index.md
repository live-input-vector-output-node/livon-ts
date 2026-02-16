---
title: Packages Overview
sidebar_position: 1
---

LIVON packages live under `packages/*` and are documented here.
Use this page to choose the right package set for runtime, transport, reliability, and tooling.

## Build variants

Default imports resolve to unminified builds.
Minified builds are available via the `./mini` subpath for runtime packages.

Example:

```ts
import {runtime} from '@livon/runtime';
import {runtime as runtimeMini} from '@livon/runtime/mini';
```

`./mini` is available for:

1. `@livon/runtime`
2. `@livon/schema`
3. `@livon/client`
4. `@livon/client-ws-transport`
5. `@livon/node-ws-transport`
6. `@livon/dlq-module`
7. `@livon/cli`

`@livon/config` does not publish runtime bundle artifacts and therefore has no `./mini` subpath.

## Core runtime stack

1. [@livon/runtime](runtime)
2. [@livon/schema](schema)
3. [@livon/client](client)
4. [@livon/client-ws-transport](client-ws-transport)
5. [@livon/node-ws-transport](node-ws-transport)

## Reliability and tooling

1. [@livon/dlq-module](dlq-module)
2. [@livon/config](config)
3. [@livon/cli](cli)

## Schema API reference

- [Schema APIs](/docs/schema)
