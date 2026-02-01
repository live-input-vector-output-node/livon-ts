---
title: "union"
sidebar_position: 11
---

Creates union schemas by trying each option until one matches.

```ts
import {union, string, number} from '@livon/schema';

const stringOrNumber = union({
  name: 'StringOrNumber',
  options: [
    string(),
    number(),
  ] as const,
});

const a = stringOrNumber.parse('hello');
const b = stringOrNumber.parse(42);
```

`union.options` can use any value schema from this section.  
API contracts (`api`) are not valid as union options.

## Parameters

- `name` (`string`, required): union schema name.
- `options` (`readonly Schema[]`, required): candidate schemas.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = union(options)`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [or](or)
- [literal](literal)
- [object](object)
- [array](array)
- [tuple](tuple)
- [and](and)
