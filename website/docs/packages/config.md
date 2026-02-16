---
title: "@livon/config"
sidebar_position: 7
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fconfig)](https://www.npmjs.com/package/@livon/config)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-config.json)](https://www.npmjs.com/package/@livon/config)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)

## Purpose

Shared monorepo configuration package for:

- TypeScript
- ESLint
- SWC
- Rsbuild / Rslib / Rspack
- Vitest

## Best for

Use this package when workspace projects need consistent tooling defaults across lint, build, and test.

## Install

```sh
pnpm add -D @livon/config
```

## Usage

### TypeScript

```json
{
  "extends": "@livon/config/tsconfig/library.json"
}
```

### ESLint

```js
module.exports = require('@livon/config/eslint/base.cjs');
```

### Rslib

```ts
import {createRslibConfig} from '@livon/config/rslib/base';

export default createRslibConfig({
  target: 'web',
  formats: ['esm', 'cjs'],
});
```

### Vitest

```ts
import {createVitestConfig} from '@livon/config/vitest/base';

export default createVitestConfig({type: 'unit'});
```

## Parameters in these examples

TypeScript:

- `extends` (`string`): path to shared tsconfig preset from [@livon/config](/docs/packages/config).

ESLint:

- `require(...)` path (`string`): shared eslint preset module path.

Rslib / Vitest:

- `createRslibConfig({...})`:
  - `target` (`'web' | 'node'`): output runtime target.
  - `formats` (`('esm' | 'cjs')[]`): module formats to emit.
- `createVitestConfig({...})`:
  - `type` (`'unit' | 'integration'`): test project mode.

## Related pages

- [Packages Overview](/docs/packages)
- [Contributing](/docs/core/contributing)
- [Roadmap](/docs/technical/roadmap)
