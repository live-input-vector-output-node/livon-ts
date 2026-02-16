---
title: "number"
sidebar_position: 3
---

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
