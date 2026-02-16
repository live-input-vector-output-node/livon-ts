---
title: "date"
sidebar_position: 5
---

Use this schema to validate `Date` values.

```ts
import {date} from '@livon/schema';

const CreatedAt = date();

const value = CreatedAt.parse(new Date());
```

## Parameters

- `name` (`string`, optional): schema node name. Default: `'date'`.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = Date`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.
