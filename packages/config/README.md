<!-- AUTO-GENERATED: run `pnpm docs:sync:package-readmes` -->
<!-- Source: website/docs/packages/config.md -->
# @livon/config

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

- `extends` (`string`): path to shared tsconfig preset from [@livon/config](https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config).

ESLint:

- `require(...)` path (`string`): shared eslint preset module path.

Rslib / Vitest:

- `createRslibConfig({...})`:
  - `target` (`'web' | 'node'`): output runtime target.
  - `formats` (`('esm' | 'cjs')[]`): module formats to emit.
- `createVitestConfig({...})`:
  - `type` (`'unit' | 'integration'`): test project mode.

## Related pages

- [Packages Overview](https://live-input-vector-output-node.github.io/livon-ts/docs/packages)
- [Contributing](https://live-input-vector-output-node.github.io/livon-ts/docs/core/contributing)
- [Roadmap](https://live-input-vector-output-node.github.io/livon-ts/docs/technical/roadmap)
