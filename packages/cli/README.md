# @livon/cli

## Install

```sh
pnpm add -D @livon/cli
```

## Purpose

CLI for syncing [schema AST](https://live-input-vector-output-node.github.io/livon-ts/docs/schema) from a running server and generating/updating client outputs.

## Basic command

```sh
livon --endpoint ws://127.0.0.1:3002/ws --out src/generated/api.ts --poll 2000
```

## Run sync and app command in one process

You can append a command directly (without `&&`):

```sh
livon --endpoint ws://127.0.0.1:3002/ws --out src/generated/api.ts --poll 2000 pnpm dev
```

If the linked command exits, `livon` exits too.  
If `livon` exits, it terminates the linked command.

If your linked command starts with flags, use `--` before it:

```sh
livon --endpoint ws://127.0.0.1:3002/ws --out src/generated/api.ts -- --some-command --flag
```

## Parameters

- `--endpoint <ws-url>` (`string`): websocket endpoint used to fetch [schema explain data](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/schema) (required unless `--port` is used).
- `--port <number>` (`number`): overrides endpoint port when endpoint host/path stay unchanged.
- `--out <file>` (`string`): output file path for generated API module.
- `--poll <ms>` (`number`): polling interval for repeated sync runs.
- `--timeout <ms>` (`number`): request timeout per sync call.
- `--event <name>` (`string`): [schema explain](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/schema) event name (default: `$explain`).
- `--method <GET|POST>` (`string`): request method for explain fetch.
- `--header key:value` (`string`, repeatable): additional request header.
- `--payload <json>` (`string`): raw JSON payload body for explain request.
- `--no-event` (`boolean`): disables event wrapping behavior for transports expecting plain request mode.
- `--` (delimiter): separates livon flags from linked command arguments.

## Typical workflow

1. Start server with [`schemaModule(..., { explain: true })`](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/schema).
2. Run CLI in watch/poll mode during client development.
3. Use generated API module in the client runtime.

## Related pages

- [@livon/schema](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/schema)
- [@livon/client](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/client)
- [Getting Started](https://live-input-vector-output-node.github.io/livon-ts/docs/core/getting-started)
