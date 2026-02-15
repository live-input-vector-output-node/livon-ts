---
title: "@livon/config"
sidebar_position: 7
---

[![config size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-config.json)](https://www.npmjs.com/package/@livon/config)

## Install

```sh
pnpm add -D @livon/config
```

## Purpose

Shared monorepo configuration package for:

- TypeScript
- ESLint
- SWC
- Rsbuild / Rslib / Rspack
- Vitest

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

export default createRslibConfig();
```

### Vitest

```ts
import {createVitestConfig} from '@livon/config/vitest/base';

export default createVitestConfig();
```

## Parameters in these examples

TypeScript:

- `extends` (`string`): path to shared tsconfig preset from [@livon/config](/docs/packages/config).

ESLint:

- `require(...)` path (`string`): shared eslint preset module path.

Rslib / Vitest:

- `createRslibConfig()` / `createVitestConfig()` take optional config overrides; call without args to use project defaults.

## Related pages

- [Packages Overview](/docs/packages)
- [Contributing](/docs/core/contributing)
- [Roadmap](/docs/technical/roadmap)
