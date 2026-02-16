---
title: Examples and Apps
sidebar_position: 11
---

This repository ships app examples under `apps/*` for end-to-end usage.

## Available apps

1. `apps/server`: WebSocket server runtime + [schema module](/docs/packages/schema) wiring.
2. `apps/client`: browser client runtime + generated API wiring.

## Example purpose

- Demonstrate [schemas](/docs/schema) across server and client.
- Demonstrate runtime composition with transports.
- Provide a reference for generated client API usage.

## Run examples

```sh
pnpm --filter apps/server dev
pnpm --filter apps/client dev
```

## Parameters

- `--filter` (`string`): workspace selector for the target app package.

## Related pages

- [Getting Started](getting-started)
- [Architecture](/docs/technical/architecture)
- [Event Flow](/docs/technical/event-flow)
- [@livon/runtime](/docs/packages/runtime)
- [@livon/schema](/docs/packages/schema)
