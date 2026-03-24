<!-- Generated from website/docs/packages/*.md. Do not edit directly. -->

# @livon/config


[![npm](https://img.shields.io/npm/v/%40livon%2Fconfig)](https://www.npmjs.com/package/@livon/config)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fconfig?label=dependencies)](https://libraries.io/npm/%40livon%2Fconfig)
[![npm publish](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/publish.yml?branch=main&label=npm%20publish)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![Snyk security](https://snyk.io/test/npm/@livon/config/badge.svg)](https://snyk.io/test/npm/@livon/config)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fconfig?label=package%20size)](https://www.npmjs.com/package/@livon/config)
[![license](https://img.shields.io/npm/l/%40livon%2Fconfig)](https://www.npmjs.com/package/@livon/config)

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

Add the tool packages for the exports you actually use. For example:

- ESLint: `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
- Rslib: `@rslib/core`
- Rsbuild: `@rsbuild/core`, `@rsbuild/plugin-react`
- Rspack: `@rspack/core`, `@rspack/plugin-react-refresh`

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

- `extends` (`string`): path to shared tsconfig preset from [@livon/config](https://livon.tech/docs/packages/config).

ESLint:

- `require(...)` path (`string`): shared eslint preset module path.

Rslib / Vitest:

- `createRslibConfig({...})`:
  - `target` (`'web' | 'node'`): output runtime target.
  - `formats` (`('esm' | 'cjs')[]`): module formats to emit.
- `createVitestConfig({...})`:
  - `type` (`'unit' | 'integration'`): test project mode.

## Related pages

- [Packages Overview](https://livon.tech/docs/packages)
- [Contributing](https://livon.tech/docs/core/contributing)
- [Roadmap](https://livon.tech/docs/technical/roadmap)
