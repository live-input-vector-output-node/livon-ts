---
title: "and"
sidebar_position: 16
---

Combines two schemas and requires both to validate the same input.

```ts
import {and, string} from '@livon/schema';

const nonEmpty = string().min(1);
const alphaNum = string().regex(/^[a-z0-9]+$/i);

const safeText = and({
  left: nonEmpty,
  right: alphaNum,
});

const value = safeText.parse('livon2026');
```

`and.left` and `and.right` can use any value schema from this section.  
API contracts (`api`) are not valid in `and`.

## Parameters

- `left` (`Schema<T>`, required): first schema.
- `right` (`Schema<U>`, required): second schema.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = left & right`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [object](object)
- [array](array)
- [tuple](tuple)
- [union](union)
- [or](or)
- [before](before)
- [after](after)
