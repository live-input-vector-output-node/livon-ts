---
title: "after"
sidebar_position: 15
---

Runs a post-parse transform on a validated schema value.

```ts
import {after, string} from '@livon/schema';

const lowerUserName = after({
  schema: string().min(2),
  hook: (value) => value.toLowerCase(),
});

const value = lowerUserName.parse('ALICE');
```

`after` can wrap any value schema from this section.  
API contracts (`api`) are not valid as `after.schema`.

## Parameters

- `schema` (`Schema<T>`, required): wrapped schema.
- `hook` (`(value, ctx) => SchemaHookAfterResult`, required): post-parse hook.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = hook output`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [before](before)
- [and](and)
