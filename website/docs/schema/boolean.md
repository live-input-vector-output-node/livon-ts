---
title: "boolean"
sidebar_position: 4
---

Creates a boolean schema.

```ts
import {boolean} from '@livon/schema';

const isAdmin = boolean();

const value = isAdmin.parse(true);
```

## Parameters

- `name` (`string`, optional): schema node name. Default: `'boolean'`.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = boolean`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.
