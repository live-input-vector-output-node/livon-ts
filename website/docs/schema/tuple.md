---
title: "tuple"
sidebar_position: 9
---

Use this schema to validate fixed-length tuples.

```ts
import {tuple, string, number} from '@livon/schema';

const UserTuple = tuple({
  name: 'UserTuple',
  items: [
    string(),
    number().int(),
  ] as const,
});

const value = UserTuple.parse(['u-1', 7]);
```

`tuple.items` can use any value schema from this section.  
API schemas (`api`) are not valid as tuple item schemas.

## Parameters

- `name` (`string`, required): tuple schema name.
- `items` (`readonly Schema[]`, required): fixed-position schema list.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = Infer<tuple.items>`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [object](object)
- [array](array)
- [union](union)
- [or](or)
- [and](and)
