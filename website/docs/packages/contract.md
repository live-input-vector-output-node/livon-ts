---
title: "@livon/contract"
sidebar_position: 4
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fcontract)](https://www.npmjs.com/package/@livon/contract)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Vulnerability scan](https://img.shields.io/github/check-runs/live-input-vector-output-node/livon-ts/main?nameFilter=vulnerability_scan&label=vulnerability%20scan)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fcontract)](https://www.npmjs.com/package/@livon/contract)

## Purpose

`@livon/contract` contains public TypeScript interfaces and defaults shared by client sync plugins.
It has no bundler-specific code.

## Exports

- plugin and sync config interfaces
- contract metadata interfaces
- manifest and remote definition interfaces
- generated artifact and sync result interfaces
- default output, import, sync, failure, and timeout constants

## Defaults

```ts
export const DEFAULT_OUTPUT_DIRECTORY = '.livon/generated';
export const DEFAULT_IMPORT_IDENTIFIER = '@livon/generated';
export const DEFAULT_SYNC_MODE = 'startup';
export const DEFAULT_FAILURE_MODE = 'warnAndUseCache';
export const DEFAULT_TIMEOUT_MILLISECONDS = 10000;
```

## Related pages

- [@livon/client-sync](client-sync)
- [@livon/plugin](plugin)
- [@livon/plugin-rsbuild](plugin-rsbuild)
