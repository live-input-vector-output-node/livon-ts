---
title: "array"
sidebar_position: 8
---

Creates array schemas with item validation.

```ts
import {array, string} from '@livon/schema';

const tags = array({
  name: 'Tags',
  item: string().min(1),
});

const value = tags.parse(['livon', 'schema']);
```

`array.item` can use any value schema from this section.  
API contracts (`api`) are not valid as array item schemas.

## Parameters

- `name` (`string`, required): array schema name.
- `item` (`Schema<T>`, required): item schema.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = item[]`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [object](object)
- [tuple](tuple)
- [union](union)
- [or](or)
- [and](and)
