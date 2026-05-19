<!-- Generated from website/docs/packages/*.md. Do not edit directly. -->

# @livon/plugin-rsbuild


[![npm](https://img.shields.io/npm/v/%40livon%2Fplugin-rsbuild)](https://www.npmjs.com/package/@livon/plugin-rsbuild)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Vulnerability scan](https://img.shields.io/github/check-runs/live-input-vector-output-node/livon-ts/main?nameFilter=vulnerability_scan&label=vulnerability%20scan)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fplugin-rsbuild)](https://www.npmjs.com/package/@livon/plugin-rsbuild)

## Purpose

`@livon/plugin-rsbuild` provides the native Rsbuild plugin wrapper for Livon client sync.
Rslib can use it through Rsbuild plugin compatibility.

## Usage

```ts
import {defineConfig} from '@rsbuild/core';
import {livonClientSyncPlugin} from '@livon/plugin-rsbuild';

export default defineConfig({
  plugins: [
    livonClientSyncPlugin({
      url: 'ws://127.0.0.1:3002/ws',
      outputDirectory: '.livon/generated',
      importIdentifier: '@livon/generated',
      failureMode: 'warnAndUseCache',
      syncMode: 'startup',
    }),
  ],
});
```

Generated files are written locally so TypeScript, IDEs, diagnostics, and CI can resolve the same typed client.
