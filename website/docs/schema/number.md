---
title: "number"
sidebar_position: 3
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


Use this schema to validate numbers with numeric constraints.

```ts
import {number} from '@livon/schema';

const Score = number().int().min(0).max(100);

const value = Score.parse(42);
```

## Parameters

- `name` (`string`, optional): schema node name. Default: `'number'`.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- `.min(min: number): Schema<number>`: requires `value >= min`.
- `.max(max: number): Schema<number>`: requires `value <= max`.
- `.int(): Schema<number>`: requires an integer.
- `.positive(): Schema<number>`: requires `value > 0`.

Shared methods on current type `T = number`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.
