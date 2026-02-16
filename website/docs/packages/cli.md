---
title: "@livon/cli"
sidebar_position: 8
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fcli)](https://www.npmjs.com/package/@livon/cli)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-cli.json)](https://www.npmjs.com/package/@livon/cli)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)

## Purpose

CLI for syncing [schema AST](/docs/schema) from a running server and generating/updating client outputs.

## Best for

Use this package when you want generated client APIs to stay in sync during local development and CI.

## Install

```sh
pnpm add -D @livon/cli
```

## Recommended command (sync + app)

```sh
livon \
  --endpoint ws://127.0.0.1:3002/ws \
  --out src/generated/api.ts \
  --poll 2000 \
  -- pnpm dev
```

## Generated output mode

`livon` always runs in `rslib` mode after sync.

- default output: `esm + cjs + d.ts`
- use `--esm` or `--cjs` to build only the selected format
- use `--js` when you only need `esm + cjs` and want to skip declaration files

With `--out src/generated/api.ts`, compiled files are written to `src/generated/dist`.
`livon` also writes `src/generated/package.json` with conditional exports, so `import { api } from './generated'` resolves to the matching build output.

## Linked process lifecycle

If the linked command exits, `livon` exits too.  
If `livon` exits, it terminates the linked command.

If your linked command starts with flags, use `--` before it:

```sh
livon --endpoint ws://127.0.0.1:3002/ws --out src/generated/api.ts -- --some-command --flag
```

## Parameters

- `--endpoint <ws-url>` (`string`): websocket endpoint used to fetch [schema explain data](/docs/packages/schema) (required unless `--port` is used).
- `--port <number>` (`number`): overrides endpoint port when endpoint host/path stay unchanged.
- `--out <file>` (`string`): output file path for generated API module.
- `--poll <ms>` (`number`): polling interval for repeated sync runs.
- `--timeout <ms>` (`number`): request timeout per sync call.
- `--event <name>` (`string`): [schema explain](/docs/packages/schema) event name (default: `$explain`).
- `--method <GET|POST>` (`string`): request method for explain fetch.
- `--header key:value` (`string`, repeatable): additional request header.
- `--payload <json>` (`string`): raw JSON payload body for explain request.
- `--esm` (`boolean`): build only ESM output (`dist/index.js`).
- `--cjs` (`boolean`): build only CJS output (`dist/index.cjs`).
- `--js` (`boolean`): builds only `esm + cjs` (skips `.d.ts` output).
- `--no-event` (`boolean`): disables event wrapping behavior for transports expecting plain request mode.
- `--` (delimiter): separates livon flags from linked command arguments.

## Typical workflow

1. Start server with [`schemaModule(..., { explain: true })`](/docs/packages/schema).
2. Run CLI in watch/poll mode during client development.
3. Use generated API module in the client runtime.

## Related pages

- [@livon/schema](schema)
- [@livon/client](client)
- [Getting Started](/docs/core/getting-started)
