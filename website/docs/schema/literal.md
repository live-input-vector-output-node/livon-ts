---
title: "literal"
sidebar_position: 10
---

Use this schema to validate one exact primitive value.

```ts
import {literal} from '@livon/schema';

const StatusActive = literal({
  name: 'StatusActive',
  value: 'active',
});

const value = StatusActive.parse('active');
```

## Parameters

- `name` (`string`, required): schema node name.
- `value` (`string | number | boolean`, required): exact accepted value.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = string | number | boolean` (based on literal value): `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [enumeration](enumeration)
- [union](union)
- [or](or)
