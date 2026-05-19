---
title: "@livon/client"
sidebar_position: 3
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fclient)](https://www.npmjs.com/package/@livon/client)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/%40livon%2Fclient)](https://www.npmjs.com/package/@livon/client)
[![Vulnerability scan](https://img.shields.io/github/check-runs/live-input-vector-output-node/livon-ts/main?nameFilter=vulnerability_scan&label=vulnerability%20scan)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)

## Purpose

`@livon/client` is the browser-safe runtime used by plugin-generated LIVON clients.
It sends typed calls over the configured Livon WebSocket endpoint and registers generated subscription handlers.

Client generation is plugin-based only. Do not run a CLI generator.

## Install

```sh
pnpm add @livon/client
```

Client apps also install a build plugin such as [`@livon/plugin-rsbuild`](plugin-rsbuild) or [`@livon/plugin`](plugin).

## Runtime API

```ts
import {configureLivonClient} from '@livon/client';

configureLivonClient({
  endpointUrl: 'ws://127.0.0.1:3002/ws',
});
```

Generated files import `createLivonRemoteFunction` and `registerLivonSubscription` from this package.
Application code normally imports from the configured generated alias instead:

```ts
import {sendMessage} from '@livon/generated';

const message = await sendMessage({
  author: 'Ada',
  text: 'Hello',
  roomId: 'global',
});
```

## Security

Generated client files are public artifacts.
They must not contain secrets, private environment values, database details, internal source paths, or server implementation code.

TypeScript types are not security.
The server must still enforce authentication, authorization, input validation, output filtering, rate limiting where appropriate, and error masking.

## Related pages

- [@livon/client-sync](client-sync)
- [@livon/plugin](plugin)
- [@livon/plugin-rsbuild](plugin-rsbuild)
